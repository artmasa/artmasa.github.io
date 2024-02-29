---
guid:     f94a2f45-e5f5-4011-917c-c00cab757c04
title:    Conditional resources with references to conditional resources in ARM Templates Fail to Deploy
layout:   post
tags:     azure arm-templates conditional resource failure
comments: true
---

In a recent project I needed to deploy a web certificate and host name bindings for a service app.<br/>
Now, this requirement was only for the production environment. Using the `condition` property available for the ARM template resources I generated a template similar to the following:

<!-- more -->

```json
{
    "variables": {
        "is-production": "[equals(parameters('environment'), 'Production')]"
    },
    "resources": [
        {
            "type": "Microsoft.Web/sites",
            "apiVersion": "2016-08-01",
            "name": "my-site",
            "properties":{
                ...
            },
            "resources": [
                {
                    "condition": "[variables('is-production')]",
                    "type": "hostNameBindings",
                    "apiVersion": "2016-08-01",
                    "properties": {
                        "thumbprint": "[reference('my-site-cert').thumbprint]",
                        ...
                    },
                    "dependsOn": [
                        "[resourceId('Microsoft.Web/certificates', 'my-site-cert')]",
                        "[resourceId('Microsoft.Web/sites', 'my-site')]"
                    ]
                }
            ],
            "dependsOn": []
        },
        {
            "condition": "[variables('is-production')]",
            "type": "Microsoft.Web/certificates",
            "apiVersion": "2014-06-01",
            "name": "my-site-cert",
            "properties": {
                ...
            },
            "dependsOn": [
                "[resourceId('Microsoft.Web/sites', 'my-site')]"
            ]
        }
    ]
}
```

We can notice on line 14 and line 29 the condition property for both resources (`hostNameBindings` and `certificates`). The expectation is that they will only be processed for production environments. When we deploy this template in production, we find no problems, but when we execute it for a non-production environment we will find the following exception:

`Resource Microsoft.Web/certificates 'my-site-cert' failed with message '{ "error": { "code": "ResourceNotFound", "message": "The Resource 'Microsoft.Web/certificates/my-site-cert' under resource group '<my resource group name>' was not found." } }'`

We know the certificate will not be found because is a non-production environment.
Dependencies are set correctly. First, before the certificate can be deployed, the site has to be deployed. Second, the host name binding will wait for the site and certificate to be deployed.

## The problem
We can notice on line 18 the thumbprint property (`"thumbprint": "[reference('my-site-cert').thumbprint]"`), which has a reference to the certificate resource. We are trying to extract the thumbprint property of the certificate and apply it to the binding.

It seems Azure deployments do not process the condition property on resources before evaluating the rest of the resource. All functions get evaluated; in the case of the host name binding resource, `[variables('is-production')]` and `[reference('my-site-cert').thumbprint]` are evaluated and then replaced in the template. 

Line 18 should now look as follows:

```json
"thumbprint": "[if(variables('is-production'), reference('my-site-cert').thumbprint, '')]"
```

For non production environments the thumbprint property should be null. At the end, it will not be deployed anyway.

Hopefully in the future the condition property can be processed apart from the rest of the resource to be able to write cleaner templates.