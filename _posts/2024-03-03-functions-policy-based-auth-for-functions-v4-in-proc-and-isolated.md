---
guid:     4b05019d-a555-470a-ad08-8d0bfd8350dd
title:    Azure Functions policy based authorization for Isolated mode
layout:   post
tags:     azure-functions functions-authorization policy-based-authorization authorize-attribute isolated-functions inproc-functions
comments: true
---

It's amazing to see that the [DarkLoop.Azure.Functions.Authorize](https://nuget.org/packages/DarkLoop.Azure.Functions.Authorize) NuGet package has received over 160K downloads in almost three years since its publication.

Since then, Microsoft has introduced another way of hosting Azure Function applications: the Isolated worker model. This mode was launched with a new set of APIs, moving away from the well-known `HttpRequest` and `HttpRequestMessage` bindings that HTTP-triggered functions have in the In-Proc hosting model. Unfortunately, this change prevented my package from utilizing the ASP.NET Core Authorization infrastructure for handling authorization in Azure Functions.

More recently ASP.NET Core integration has been added to the Isolated worker hosting model. It was time to bring the `AuthorizeAttribue` behavior to Isolated worker Function apps.

I've been working on refactoring the solution to provide common shared functionality for both In-Proc and Isolated models.

- [`DarkLoop.Azure.Functions.Authorize`](https://nuget.org/packages/DarkLoop.Azure.Functions.Authorize) will remain as the package used for In-Proc model hosted applications.
- [`DarkLoop.Azure.Functions.Authorization.Isolated`](https://nuget.org/packages/DarkLoop.Azure.Functions.Authorzation.Isolated) will become the package for Isolated model hosted applications.

One significant improvement when transitioning from In-Proc to Isolated model is the support for a true middleware framework. Previously, `DarkLoop.Azure.Functions.Authorize` relied on invocation filters, which remained in preview. To notify the function consumer of an authorization failure, the function had to throw an exception, preventing the stack from reaching the function logic. The new module for the Isolated model leverages middleware, behaving as expected. The application will not log exceptions, but users will receive communication about authorization failures.

## How to use it?

### Add package to your Azure Function app project
```powershell
dotnet add package DarkLoop.Azure.Functions.Authorization.Isolated
```

### Instrument your application for authorization
```csharp
// Instrument your application for authorization
var host = new HostBuilder()
    .ConfigureFunctionsWebAppliction(builder =>
    {
        builder.UseFunctionsAuthorization(); // Explicit middleware registration
    })
    .ConfigureServices(services =>
    {
        // Add authorization services
        services
            .AddFunctionsAuthorization()
            .AddJwtBearer(options =>
            {
                options.Authority = "https://login.microsoftonline.com/your-tenant-id";
                options.Audience = "your-client-id";
                // Other JWT configuration options...
            });

        // Define custom authorization policies
        services.AddFunctionsAuthorization(options =>
        {
            options.AddPolicy("OnlyAdmins", policy => policy.RequireRole("Admin"));
        });

        // Add other services as needed
    })
    .Build();

host.Run();
```
Notice the `UseFunctionsAuthorization()` explicit middleware registration for the application. This instructs the function app to place this middleware right before the function execution middleware.

The authentication and authorization services are added in the same way as before for any ASP.NET Core web application. You'll notice that we've retained the methods introduced for the In-Proc model. While these methods have no effect for Isolated model hosted apps, we've kept them in place for compatibility during migrations from In-Proc to Isolated mode.

### Securing Your HTTP Triggers
Just as with In-Proc, securing your triggers involves decorating them with the authorization attribute.

```csharp
[FunctionAuthorize]
public class Functions
{
  [FunctionName("get-record")]
  public async Task<IActionResult> GetRecord(
    [HttpTrigger("get")] HttpRequest req, ILogger log)
  {
    var user = req.HttpContext.User;
    var record = GetUserData(user.Identity.Name);
    return new OkObjectResult(record);
  }

  [Authorize(Policy = "OnlyAdmins")]
  [FunctionName("get-all-records")]
  public async Task<IActionResult> GetAllRecords(
    [HttpTrigger("get")] HttpRequest req, ILogger log)
  {
    var records = GetAllData();
    return new OkObjectResult(records);
  }
}
```
Notice how the second function, `get-all-records`, is using ASP.NET Core's `AuthorizationAttribute`. Now that we don't rely on invocation filters, we can use either `FunctionAuthorizeAttribute` or `AuthorizeAttribute`. The former attribute, which was introduced for this framework, has been kept to make it easy to migrate applications running on the In-Proc to the Isolated mode. Notably, `FunctionAuthorizeAttribute` in the Isolated module is simply an inheriting class of `AuthorizeAttribute`.

Additionally, is nice that for the Isolated model, the default authentication level is `Anonymous`; making it really simple to just declare the trigger attribute along with the authorization one.

<br/>
All this functionality is in preview, and I'm actively working on adding more test coverage to the modules.

## What's nex?
Working on different ideas to empower consumers to implement more specific scenarios tailored to their needs.

- #### Extensibility
  I'm working on allowing the definition of authorzation for functions without relying solely attributes. This will envolve exposing interfaces for greater flexibility.

- #### Code generators
  Generating code based on how classes and functions are decorated and remove need for reflection to consume the authorization metadata. Having code generators will optimize function startup time by avoiding runtime reflection operations.
  > It's important to note that the module currently performs JIT metadata generation only the first time a function is invoked.

Feel free to share your thoughts in the comments, and don't hesitate to open any issues in the project's [repository](https://github.com/dark-loop/functions-authorize). Your feedback is valuable!