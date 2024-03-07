---
guid:     ca4a2e4e-1826-4a05-8801-f67784dec8b7
legacyid: /post.aspx?id=da4fe167-0972-4c0d-ba64-945662ad8e4d
layout:   post
title:    Bringing AuthorizeAttribute to .NET Azure Functions v2
comments: true
tags:     azure-functions authorize-attribute authorization policy-based-authorization
---

Azure Functions is a great technology, and even greater when we talk about the .NET support. It allows developer to focus on creating solutions to problems they have been assigned to solve, and not worrying about the infrastructure.

[Update available for V3](functionauthorize-for-azure-functions-v3)

A big change for Azure Functions V2 is that runs on top of ASP.NET Core 2 hosting model. Now, lets not get confused; Azure Functions is not ASP.NET Core WebAPI because we are not talking about just HTTP endpoints. Through Azure Functions we are able to trigger actions from different sources and this is what makes it a powerful tool. One of my favorites - [Durable Functions](https://docs.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-overview) extension, we can execute asynchronous workflows without having to be concerned where we were going to hold state like in the days of WF.

<!-- more -->

Enough praising Azure Functions. Let's come back to the HTTP side of things. Azure functions HTTP trigger relies on its own Authorization Levels to handle function level access and some of them have not been implemented yet; so we rely heavily on configuring clients with keys in order to access the functions. We can also specify the `AuthorizationLevel.Anonymous` in our `HttpTriggerAttribute` and setup [Authentication/Authorization](https://docs.microsoft.com/en-us/azure/app-service/overview-authentication-authorization) at the App Service level which is an auth proxy layer for applications hosted in Azure. It works great with ASP.NET, but it does not work all the way to the app level with Azure Functions. Tokens are still passed to the application in the function's request headers, but we need to handle it. This is painful when some of that information is needed to authorize access to resources.

For ASP.NET developers, the `AuthorizeAttribute` is a great way to specify policy checks that should be executed before the application enters the method logic we are trying to protect. `AuthorizeAttribute` is traced for all routes exposed by the application. When ASP.NET auth middleware handles a request these policies are checked returning an error code in the response if authentication is missing or policies do not pass the check.

Azure Functions hosting environment does not register this middleware and the `AuthorizeAttribute` is useless. Remember, Azure Functions rely on the `AuthorizationLevel` parameter in the `HttpTriggerAttribute` to handle authorization. We'll see in the future what the Azure Functions team does to handle User level authorization. At the time of writing this post, it has not been implemented.

## What do we do?
### Lets bring WebJobAuthorize to the rescue
The Azure Functions team has provided the [Function Filters](https://github.com/Azure/azure-webjobs-sdk/wiki/Function-Filters) feature which is still in preview and they ask us to be cautious about using it in production. My solution to the authorization problem relies on this feature, so I will ask the same thing.

Because this solution relies on the `IFunctionInvocationFilter` interface we cannot use the `AuthorizeAttribute` and I did not want to depend on two attributes to achieve the goal, so I have created the **`WebJobAuthorizeAttribute`** that we will use the same way we used the `AuthorizeAttribute`.

This is an open source library you can find at: [WebJobs Authorize](https://github.com/dark-loop/webjobs-authorize)

### Configuring It
I am providing a nuget package which its version also contains the preview word and it will stay in this pre-release state until the Functions Team delivers the Filters feature. To get your hands on the package you can install it with:

Package Manager
```powershell
Install-Package DarkLoop.Azure.WebJobs.Authorize -Version 1.0.25-preview
```

.NET CLI
```dos
dotnet add package DarkLoop.Azure.WebJobs.Authorize --version 1.0.25-preview
```

### Lets setup authentication and authorization
Just as in ASP.NET Core we need to setup the authentication and authorization targeting specifics in our app, but instead of registering using  IServiceCollection, we will use IWebJobsBuilder in our startup class.

```typescript
using Microsoft.Azure.WebJobs.Hosting;
using MyFunctionAppNamespace;
 
[assembly: WebJobsStartup(typeof(Startup))]
namespace MyFunctionAppNamespace
{
  class Startup : IWebJobsStartup
  {
    public void Configure(IWebJobsBuilder builder)
    {
      builder
        .AddAuthentication()
        .AddOpenIdConnect(options =>
        {
          options.ClientId = "<my-client-id>";
          // ... more options here
        })
        .AddJwtBearer(options =>
        {
          options.Audience = "<my-audience>";
          // ... more options here
        });
 
      builder
        .AddAuthorization(options =>
        {
          options.AddPolicy("OnlyAdmins", policyBuilder =>
          {
            // configure my policy requirements
          });
        });
    }
  }
}
```
These are the same methods we would call for ASP.NET Core when configuring authentication and authorization. We could actually use: `builder.Services.AddAuthentication()` and `builder.Services.AddAuthorization()` and they would achieve the exact same thing, with the exception of the not covering one of the schemes that was already registered by the Azure Functions setup (remember the Functions `AuthorizationLevel` authorization). This is automatically handled when calling `AddAuthentication()` using `IWebJobsBuilder` instead of `IServiceCollection`. Not configuring this scheme would throw an exception when calling your HTTP functions.

### Using WebJobAuthorizeAttribute
`WebJobAuthorizeAttribute` implements `IAuthorizeData` as `AuthorizeAttribute` does, constructor and properties are the same, attribute targets are the same (Class and Method). Using it is just as using Authorize in your ASP.NET application. Using `WebJobAuthorize` will also replace the User property on the current `HttpContext` with the generated `ClaimsPrincipal` in case you need it in your function logic

```typescript
public class Functions
{
  [WebJobAuthorize]
  [FunctionName("get-record")]
  public async Task<IActionResult> GetRecord(
    [HttpTrigger(AuthorizationLevel.Anonymous, "get")] HttpRequest req,
    ILogger log)
  {
    var user = req.HttpContext.User;
    var record = GetUserData(user.Identity.Name);
    return new OkObjectResult(record);
  }
 
  [WebJobAuthorize(Policy = "OnlyAdmins")]
  [FunctionName("get-all-records")]
  public async Task<IActionResult> GetAllRecords(
    [HttpTrigger(AuthorizationLevel.Anonymous, "get")] HttpRequest req,
    ILogger log)
  {
    var records = GetAllData();
    return new OkObjectResult(records);
  }
}
```
We can also use it at the class level and it will apply to all functions in the class. Important to note that `IFunctionInvocationFilter` applied at the class level will affect all functions even if they are not HTTP functions. Internally the filter ignores non HTTP functions and exists without evaluating Authentication and Authorization.

```typescript
[WebJobAuthorize]
public class Functions
{
  [FunctionName("get-record")]
  public async Task<IActionResult> GetRecord(
    [HttpTrigger(AuthorizationLevel.Anonymous, "get")] HttpRequest req,
    ILogger log)
  {
    var user = req.HttpContext.User;
    var record = GetUserData(user.Identity.Name);
    return new OkObjectResult(record);
  }
 
  [WebJobAuthorize(Policy = "OnlyAdmins")]
  [FunctionName("get-all-records")]
  public async Task<IActionResult> GetAllRecords(
    [HttpTrigger(AuthorizationLevel.Anonymous, "get")] HttpRequest req,
    ILogger log)
  {
    var records = GetAllData();
    return new OkObjectResult(records);
  }
}
```
We can also note the use of `AuthorizationLevel.Anonymous` in the `HttpTrigger` attribute. Sadly, the noise is needed because the default value for `HttpTrigger` is `AuthorizationLevel.Function` and if we don't set it to `Anonymous` the Functions middleware will try to validate the authorization specified in the trigger attribute before it gets to our filter. Nothing we can do about that.

Let me know what you think in the comments.