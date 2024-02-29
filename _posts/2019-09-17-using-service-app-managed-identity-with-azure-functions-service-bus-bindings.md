---
guid:     91c79a18-95c6-45c7-addd-b618afd26b0a
legacyid: /post.aspx?id=bafff9d4-7b14-423c-9f5b-a2ef34287730
title:    Using App Service Managed Identity with Azure Functions Service Bus/Event Hub Bindings
layout:   post
tags:     azure-service-bus azure-functions managed-identity event-hub
comments: true
---
Nothing better than removing all secrets from source and configuration settings in our applications.
Azure App Services have a feature called Managed Identity in which you can configure an application to run under the context of a Service Principal to access other resources the application has been granted access to.
In the case of Azure Functions you can enable it by accessing the **Identity** link under the **Platform features** tab.

<!-- more -->

![Functions Azure Platform features tab](/images/2019-09-17-01.png)

Enable Managed Identity by turning On the **Status** control

<img src="/images/2019-09-17-02.png" alt="Enable system assigned identity illustration" style="width:550px" />

Now that this is enabled it's just a matter of configuring our function app backend to make it work.<br/>
A typical setup for a function app would look like this:

```typescript
public class Functions
{
    [FunctionName("MyFunction")]
    public static void Run(
        [ServiceBusTrigger("myqueue", Connection = "myQueueConn")]string myQueueItem, ILogger log)
    {
        log.LogInformation($"C# ServiceBus queue trigger function processed message: {myQueueItem}");
    }
}
```

Now, for this to work we need to add the `myQueueConn` connection string setting to our service app configuration in the following format:<br/>
`Endpoint=sb://<service-bus-resource>.servicebus.windows.net;SharedAccessSignature=<token-here>`

The **PROBLEM** with this approach is that now we are relying on storing secrets (token in this case) in our app service  in order to communicate with Service Bus and defeats the purpose of enabling Managed Identity for the service app.

Luckily for us Microsoft just released version 4.0.0 of the Azure Service Bus Client for .NET which comes with native support for Managed Identity.

Digging into Azure Service Bus' repository I noticed that the `ServiceBusConnectionStringBuilder` class has a new `Authentication` property that supports only 2 values: `Other` and `ManagedIdentity`.
This property is not visible when coding against our functions inside Visual Studio or Visual Studio Code because the current Azure Functions Service Bus Extension references an old version of the Azure Service Bus Client nuget package **(Microsoft.Azure.ServiceBus 3.0.2)** which does not have support for Managed Identity through a connection string.

All we have to do now is to add a reference to the new client package in our project:
```
<ItemGroup>
    <PackageReference Include="Microsoft.Azure.ServiceBus" Version="4.0.0" />
    <PackageReference Include="Microsoft.Azure.WebJobs.Extensions.ServiceBus" Version="3.0.6" />
    <PackageReference Include="Microsoft.NET.Sdk.Functions" Version="1.0.29" />
</ItemGroup>
```
And finally the configured `myQueueConn` connection string setting can be simply set to just:<br/>
`Endpoint=sb://<service-bus-resource>.servicebus.windows.net;Authentication=Managed Identity`;
and our function app will be able to listen for or send messages using the app service identity without the need to store or retrieve secrets through configuration or extra code!

The approach with Event Hubs would be just like for Service Bus, but you need to add a reference to version `4.1.0` of the `Microsoft.Azure.EventHubs.Processor` nuget package instead of `Microsoft.Azure.ServiceBus`.