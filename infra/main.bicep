// ez.darts hosting: Static Web App (frontend + managed .NET Functions API) and a
// Storage account for Table Storage. Deploy into a resource group in a region that
// supports managed functions: westeurope, eastus2, centralus, westus2 or eastasia.

@description('Region for all resources.')
param location string = resourceGroup().location

@description('Static Web App name.')
param staticWebAppName string = 'ez-stapp-darts'

@description('Static Web App plan. Free covers managed functions and PR preview environments.')
@allowed([
  'Free'
  'Standard'
])
param staticWebAppSku string = 'Free'

@description('Storage account name (3-24 lowercase letters and digits, globally unique).')
@minLength(3)
@maxLength(24)
param storageAccountName string = 'ezstdarts'

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    // Managed functions in Static Web Apps can't use managed identity, so the API
    // connects with the account key from the StorageConnectionString app setting.
    allowSharedKeyAccess: true
  }
}

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource healthCheckTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tableService
  name: 'HealthCheck'
}

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: location
  sku: {
    name: staticWebAppSku
    tier: staticWebAppSku
  }
  properties: {
    // Deployed from GitHub Actions with the deployment token, so no repository link here.
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
  }
}

resource staticWebAppSettings 'Microsoft.Web/staticSites/config@2023-12-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    StorageConnectionString: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
  }
}

output staticWebAppName string = staticWebApp.name
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output storageAccountName string = storage.name
