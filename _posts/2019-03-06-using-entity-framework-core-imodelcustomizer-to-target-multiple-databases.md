---
guid:     2b628828-a4ec-4aff-a9b0-cd1ac1dda54e
title:    Using Entity Framework Core IModelCustomizer to target multiple data stores
layout:   post
tags:     entity-framework-core db-context model-customizer
comments: true
---

Some projects are designed to be optionally deployed against different back-end data stores. In these cases we want to configure our data model depending on the platform we are targeting, but keeping the models agnostic to the data store to simplify its use when developing our business logic.

Lets say we work for the Smart Retail Solutions company, and have been tasked to create a retail sales software system for small businesses which may have different database technology preferences.

<!-- more -->

### Typical DbContext Setup
A typical `DbContext` setup would look as follows inside our **SRS.SmartRetail.Data** assembly.
```csharp
public class SmartRetailDbContext : DbContext
{
  public SmartRetailDbContext(DbContextOptions options) : base(options) { }

  public DbSet<Product> Products { get; set; }

  public DbSet<Order> Orders { get; set; }

  //... more db sets here

  protected override OnModelCreating(ModelBuilder builder)
  {
    var products = builder.Entity<Product>();
    products.HasKey(p => p.Id);
    //...more configuration here
  }
}
```
Our job can get complicated by using `DbContext.OnModelCreating(ModelBuilder)` method and trying to target multiple providers. Instead of overriding `OnModelCreating(ModelBuilder)` we should take this code to a different assembly.

### Separating Model Configuration by Data Store
Lets create new assemblies for each provider we want to target referencing our Data assembly containing our SmartRetailDbContext:

- SRS.SmartRetail.Data.SqlServer
- SRS.SmartRetail.Data.MySql
- ...
Now we are able to focus on targeting specific data store features and limitations:

```csharp
using Microsoft.EntityFrameworkCore.Relational;

namespace SRS.SmartRetail.Data.SqlServer
{
  internal class ProductConfiguration : IEntityTypeConfiguration<Product>
  {
    public void Configure(EntityTypeBuilder<Product> builder)
    {
      builder.HasKey(p => p.Id);
      //... more product config here
    }
  }
}
```

### How do we bring this Configration to our DbContext?
Instead of bringing these configuration through `ModelBuilder.ApplyConfiguration(IEntityTypeConfiguration<TEntity>)` inside of the `OnModelCreating(ModelBuilder)` override, we will implement `Microsoft.EntityFrameworkCore.Infrastructure.IModelCustomizer` inside the assembly we created for every data store provider.<br/>
`IModelCustomizer` provides the Customize method that passes a `ModelBuilder` and an instance of our `DbContext`. We can now bring our model configuration and apply it to the customizer.<br/>
By the way, Entity Framework already has `IModelCustomizer` implementations. In the case of relational databases they have created the `RelationalModelCustomizer` living in the `Microsoft.EntityFrameworkCore.Relational` assembly; so we will start at this point for our example.

```csharp
namespace SRS.SmartRetail.Data.SqlServer
{
  public class SmartRetailSqlServerModelCustomizer : RelationalModelCustomizer
  {
    public SmartRetailSqlServerModelCustomizer(
      ModelCustomizerDependencies dependencies) : base(dependencies) { }

    public override void Customize(ModelBuilder builder, DbContext context)
    {
      builder.HasDefaultSchema("srs");
      builder.ApplyConfiguration(new ProductConfiguration());
      //... applying more configurations

      base.Customize(builder, context);
    }
  }
}
```

As you can see, the `Customize` method gives us all the possibilities of the `OnModelCreating` override, even to define all the configuration within this method. I prefer to have a configuration class per entity.

Now, all this configuration lives in a completely different assembly from our `DbContext`. How do we  bring them together?

### Bringing DbContext and Configuration Together
Entity Framework Core provides the `AddDbContext<TContext>(Action<DbContextOptionsBuilder>, ...)` extension method to add our `DbContext` to the application's service collection. Here we will configure our model customizer.

```csharp
public void ConfigureServices(IServiceCollection services)
{
  //... some services configured here

  services.AddDbContext<SmartRetailDbContext>(optionsBuilder =>
    optionsBuilder
      .UseSqlServer("<my-connection-string>")
      // here is where we replace the default customizer
      .ReplaceService<IModelCustomizer, SmartRetailSqlServerModelCustomizer>()
  );

  //... more services configured here
}
```

When we call `UseSqlServer`, Entity Framework configures the default `IModelCustomizer` for that provider. Right after this we override it to configure our own.

We can go one step further and provide an extension method in our provider specific assembly to configure our context and model.

```csharp
namespace Microsoft.Extensions.DependencyInjection
{
  public static class SmartRetailServiceCollectionExtensions
  {
    public static IServiceCollection AddSmartRetailSqlDbContext(
      this IServiceCollection services, string connectionString)
    {
      services.AddDbContext<SmartRetailDbContext>(optionsBuilder =>
        optionsBuilder
          .UseSqlServer(connectionString)
          .ReplaceService<IModelCustomizer, SmartRetailSqlModelCustomizer>());
    }
  }
}
```
And we now use it in our startup.cs

```csharp
public class Startup
{
  public void ConfigureServices(IServiceCollection services)
  {
    //... some services config here
    
    services.AddSmartRetailSqlDbContext("<my-connection-string>");

    //... more services config here
  }
}
```

Following this approach we are able to develop our models and business logic independently from the target data store.
We could also achieve migrations targeting different data store platforms. But that will be another post.