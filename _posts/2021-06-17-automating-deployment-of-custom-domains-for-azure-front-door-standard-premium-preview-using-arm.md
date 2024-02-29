---
guid:     842a5979-2003-4c35-a498-08af42c6b300
title:    Automating deployment of custom domains for Azure Front Door Standard/Premium (Preview) using ARM
layout:   post
tags:     arm-template azure-front-door custom-domain
comments: true
---

Azure Front Door for standard and premium tiers offers great flexibility for deploying the different components within it, in contrast to the current Front Door offering where all the components have to be defined in a single resource definition.
This new behavior gives us the ability to use a central Front Door instance and manage multiple independent endpoints that can be managed separately.

As in many other, network and application services, Azure gives the option to configure custom domains. All you need is to proof domain's ownership and you are ready to go. And when you manage your public DNS zone in Azure you can automate the creation of verification records to automate provisioning the custom domain configuration for your services.
<!-- more -->

When it comes to Front Door (Preview) custom domains with ARM it's a little tricky. You would expect to be able to reference your custom domain resource and get the verification token to create your TXT record. The problem is that the custom domain deployment `"Microsoft.Cdn/profiles/customDomains"` does not return (even for references) until the domain has been validated and associated to an endpoint (`Microsoft.Cdn/profiles/afdEndpoints`). Having the following definition in your ARM template would block the template until the validation and association are complete:

```json
{
    "type": "Microsoft.Cdn/profiles/customDomains",
    "apiVersion": "2020-09-01",
    "name": "{profile-name}/site-darkloop-com",
    "properties": {
        "azureDnsZone": {
            "id": "/subscriptions/{sub-id}/resourceGroups/{resc-grp}/providers/Microsoft.Network/dnsZones/darkloop-com"
        },
        "hostName": "site.darkloop.com"
    }
}
```

To enable the completion of the custom domain resource we need to either:

1. Go to Azure portal and get the `validationToken` for the domain and manually create the DNS record, or if you specify an `azureDnsZone` in the ARM resource, click the **Pending** link for the domain and then select **Add** button to create the TXT validation record. Or...
2. Automate the retrieval of validation token using the Azure Management API. We could use the Resource Graph (`Microsoft.ResourceGraph/query`) within our template but at the time of writing Resource Graph for some reason still does not support returning data for `Microsoft.Cdn/profiles/customDomains` type.

We will focus on number 2 for this post.

To read the validation token for the domain we will use `"Microsoft.Resources/deploymentScripts"` resource type. In this example I will use a PowerShell inline script.

```json
{
    "type": "Microsoft.Resources/deploymentScripts",
    "name": "query",
    "apiVersion": "2020-10-01",
    "kind": "AzurePowerShell",
    "location": "[resourceGroup().location]",
    "properties": {
        "cleanupPreference": "Always",
        "retentionInterval": "PT1H",
        "azPowerShellVersion": "6.0",
        "environmentVariables": [
            {
                "name": "AUTH_TOKEN",
                "secureValue": "[parameters('token')]"
            }
        ],
        "arguments": "[concat('-account ', parameters('account'), ' -subId ', subscription().subscriptionId, ' -resourceGroup ', resourceGroup().name, ' -profileName ', parameters('profileName'), ' -domainName ', variables('domainName'))]",
        "scriptContent": "
            param([string] $account, [string] $subId, [string] $resourceGroup, [string] $profileName, [string] $domainName)
            $authToken = $env:AUTH_TOKEN
            Start-Sleep -Seconds 60
            Connect-AzAccount -AccessToken \"$($authToken)\" -AccountId $account -Subscription $subId
            $valToken = (ConvertFrom-Json (Invoke-AzRestMethod -Method get -Path \"/subscriptions/$($subId)/resourceGroups/$($resourceGroup)/providers/Microsoft.Cdn/profiles/$($profileName)/customDomains/$($domainName)?api-version=2020-09-01\").content).properties.validationProperties.validationToken
            $DeploymentScriptOutputs = @{}
            $DeploymentScriptOutputs['validationToken'] = $valToken
        "
    }
}
```

Note the call to `Start-Sleep`. We are making sure the custom domain in the first block has executed and it's waiting for validation to execute this script. You can even specify a shorter span since creating the container instance takes some time.

Because this script is executed inside a container instance it is not running in the context of the ARM deployment and credentials need to be passed. You can see in line 22 I'm connecting to the Azure environment (`Connect-AzAccount`) and credentials need to be provided. In this case I'm retrieving an access token for the management API prior to executing the template and passing it as a `securestring` ARM parameter.

IMPORTANT to note that I'm not passing the `accessToken` as a PowerShell parameter to the script; instead I'm setting it as an environment variable to the container. PowerShell parameters are logged and disclosed in the Azure portal and we want to protect sensitive information. Once the script is executed the environment variable will be destroyed along with the container instance.

Once connected to Azure, we can retrieve the validation token using the `Invoke-AzRestMethod` against the resource ID for the custom domain and api-version to gain access to the properties and added to the outputs variable for the deployment script.

Once the script has finished executing we can access the outputs with `"[reference('query').outputs.validationToken]"` and pass it to the DNS TXT record resource and fulfill the validation requirement without a manual step.

You can see the full template bellow: (endpoint definitions are excluded, but references to custom domain ID need to be specified for successful domain deployment)

```json
{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "parameters": {
        "accessToken": {
            "type": "securestring"
        },
        "account": {
            "type": "string"
        },
        "profileName": {
            "type": "string"
        },
        "domainName": {
            "type": "string"
        },
        "dnsName": {
            "type": "string"
        },
        "dnsResourceGroup": {
            "type": "string"
        }
    },
    "variables": {
        "domainName": "[replace(parameters('domainName'), '.', '-')]",
        "domainFullName": "[concat(parameters('profileName'), '/', variables('domainName'))]",
        "dnsId": "[resourceId(parameters('dnsResourceGroup'), 'Microsoft.Network/dnszones', parameters('dnsName'))]"
    },
    "resources": [
        {
            "type": "Microsoft.Cdn/profiles",
            "apiVersion": "2020-09-01",
            "name": "[parameters('profileName')]",
            "location": "global",
            "sku": {
                "name": "Premium_AzureFrontDoor"
            },
            "properties": {}
        },
        {
            "type": "Microsoft.Cdn/profiles/customDomains",
            "apiVersion": "2020-09-01",
            "name": "[variables('domainFullName')]",
            "properties": {
                "azureDnsZone": {
                    "id": "[variables('dnsId')]"
                },
                "hostName": "[parameters('domainName')]"
            },
            "dependsOn": [
                "[resourceId('Microsoft.Cdn/profiles', parameters('profileName'))]"
            ]
        },
        {
            "type": "Microsoft.Resources/deploymentScripts",
            "name": "query",
            "apiVersion": "2020-10-01",
            "kind": "AzurePowerShell",
            "location": "[resourceGroup().location]",
            "properties": {
                "cleanupPreference": "Always",
                "retentionInterval": "PT1H",
                "azPowerShellVersion": "6.0",
                "environmentVariables": [
                    {
                        "name": "AUTH_TOKEN",
                        "secureValue": "[parameters('accessToken')]"
                    }
                ],
                "arguments": "[concat('-account ', parameters('account'), ' -subId ', subscription().subscriptionId, ' -resourceGroup ', resourceGroup().name, ' -profileName ', parameters('profileName'), ' -domainName ', variables('domainName'))]",
                "scriptContent": "
                    param([string] $account, [string] $subId, [string] $resourceGroup, [string] $profileName, [string] $domainName)
                    $authToken = $env:AUTH_TOKEN
                    Connect-AzAccount -AccessToken \"$($authToken)\" -AccountId $account -Subscription $subId
                    Start-Sleep -Seconds 60
                    $valToken = (ConvertFrom-Json (Invoke-AzRestMethod -Method get -Path \"/subscriptions/$($subId)/resourceGroups/$($resourceGroup)/providers/Microsoft.Cdn/profiles/$($profileName)/customDomains/$($domainName)?api-version=2020-09-01\").content).properties.validationProperties.validationToken
                    $DeploymentScriptOutputs = @{}
                    $DeploymentScriptOutputs['validationToken'] = $valToken
                "
            },
            "dependsOn": [
                "[resourceId('Microsoft.Cdn/profiles', parameters('profileName'))]"
            ]
        },
        {
            "type": "Microsoft.Resources/deployments",
            "apiVersion": "2020-10-01",
            "name": "dns",
            "dependsOn": ["query"],
            "resourceGroup": "[parameters('dnsResourceGroup')]",
            "properties": {
                "mode": "Incremental",
                "expressionEvaluationOptions": {
                    "scope": "Outer"
                },
                "template": {
                    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
                    "contentVersion": "1.0.0.0",
                    "resources": [
                        {
                            "type": "Microsoft.Network/dnszones/TXT",
                            "apiVersion": "2018-05-01",
                            "name": "[concat(parameters('dnsName'), '/_dnsauth.', replace(parameters('domainName'), concat('.', parameters('dnsName')), ''))]",
                            "properties": {
                                "TTL": 3600,
                                "TXTRecords": [
                                    {
                                        "value": [ 
                                            "[reference('query').outputs.validationToken]"
                                        ]
                                    }
                                ]
                            }
                        }
                    ]
                }
            }
        }
    ]
}
```