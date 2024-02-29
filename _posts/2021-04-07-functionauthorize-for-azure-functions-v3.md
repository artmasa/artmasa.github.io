---
layout: post
title: FunctionAuthorize for Azure Functions v3
comments: true
legacyid: /post.aspx?id=33e8e19e-d6a9-4aad-88c8-b27eebb73d4f
---

In a prior post I discussed [Bringing the AuthorizeAttribute behavior to Azure Functions v2]({% post_url 2019-03-19-bringing-authorizeattribute-to-net-azure-functions-v2 %}). Since then V3 has been around for quite some time and I had not ported the referenced package with compatibility for V3 until now ([GitHub repo](https://github.com/dark-loop/functions-authorize)).

Microsoft has not yet made the Functions Filter feature GA and is still considered a preview feature. So the new package is made available as a pre-release package.

Since some names within Azure Functions SDK are moving from `WebJobs...` to `Functions...`; this package also moves the attribute from `WebJobAuthorizeAttribute` to `FunctionAuthorizeAttribute`.

The way you setup your environment is accomplished the same way as v2, but now we target `FunctionsStartup` to add the authentication services and configuration:

```csharp
using Microsoft.Azure.Functions.Extensions.DependencyInjection;
using MyFunctionAppNamespace;

[assembly: FunctionsStartup(typeof(Startup))]
namespace MyFunctionAppNamespace
{
  class Startup : FunctionsStartup
  {
    public void Configure(IFunctionsHostBuilder builder)
    {
      builder
        .AddAuthentication(options =>
        {
          options.DefaultAuthenticationScheme = JwtBearerDefaults.AuthenticationScheme;
          options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
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
And now it's just about adding our FunctionAuthorizeAttribute to our function classes or methods to protect our functions with our favorite IdP!

```csharp
public class Functions
{
  [FunctionAuthorize]
  [FunctionName("get-record")]
  public async Task<IActionResult> GetRecord(
    [HttpTrigger(AuthorizationLevel.Anonymous, "get")] HttpRequest req,
    ILogger log)
  {
    var user = req.HttpContext.User;
    var record = GetUserData(user.Identity.Name);
    return new OkObjectResult(record);
  }

  [FunctionAuthorize(Policy = "OnlyAdmins")]
  [FunctionName("get-all-records")]
  public async Task<IActionResult>(
    [HttpTrigger(AuthorizationLevel.Anonymous, "get")] HttpRequest req,
    ILogger log)
  {
    var records = GetAllData();
    return new OkObjectResult(records);
  }
}
```

As in V2, this middleware only works on HTTP triggered functions. Even when applied to functions with different trigger the attribute will be ignored.
Also important to remember to specify authLevel paramater for `HttpTriggerAttribute` as `AuthorizationLevel.Anonymous`.

### Installing the Nuget package: 
```dos
dotnet add package DarkLoop.Azure.Functions.Authorize
```

> UPDATE: I don't know for how long the filters feature will be in preview. Azure Functions has been moved to newer versions since introducing this feature. I went ahead and make the package a release version: [DarkLoop.Azure.Functions.Authorize](https://www.nuget.org/packages/DarkLoop.Azure.Functions.Authorize)