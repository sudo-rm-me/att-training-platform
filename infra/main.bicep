// Academy training platform: Azure infrastructure
//
// Resources (all in the target resource group):
//   - Log Analytics workspace
//   - Azure Container Registry (admin user disabled; pulls via managed identity)
//   - User-assigned managed identity for the app
//   - Storage account + private "media" blob container (Entra auth only, no shared keys)
//   - Key Vault (RBAC) holding the app's secrets
//   - PostgreSQL Flexible Server + "att" database
//   - Container Apps environment + container app (HTTPS ingress, health probes, autoscale)
//
// First deployment: leave containerImage empty. The app starts on a placeholder image
// until the GitHub Actions workflow builds and deploys the real one.

targetScope = 'resourceGroup'

@description('Azure region. Defaults to the resource group location.')
param location string = resourceGroup().location

@description('Short lowercase prefix for resource names (letters, numbers, hyphens).')
@minLength(2)
@maxLength(10)
param namePrefix string = 'att'

@description('Full image reference, e.g. myacr.azurecr.io/att:<sha>. Empty = placeholder image (bootstrap).')
param containerImage string = ''

// --- Auth ----------------------------------------------------------------

@description('Entra ID tenant (directory) id.')
param entraTenantId string

@description('Application (client) id of the sign-in app registration.')
param entraClientId string

@secure()
@description('Client secret of the sign-in app registration.')
param entraClientSecret string

@secure()
@description('Auth.js session encryption secret (32+ random bytes).')
param authSecret string

@description('Comma-separated emails that are made admins on sign-in.')
param initialAdminEmails string = ''

// --- App -----------------------------------------------------------------

@description('IANA timezone for streak days and due dates.')
param appTimezone string = 'Europe/London'

@minValue(0)
@maxValue(10)
param minReplicas int = 1

@description('Mailbox that sends reminder emails via Microsoft Graph (needs the Mail.Send application permission). Empty = in-app reminders only.')
param mailSender string = ''

@description('When the daily reminders job runs (cron, UTC).')
param remindersSchedule string = '0 7 * * *'

@description('Days overdue before a manager digest flags someone as escalated.')
param escalateAfterDays int = 14

@secure()
@description('Shared secret for the reminders job. Leave empty to derive one from authSecret.')
param cronSecret string = ''

@minValue(1)
@maxValue(30)
param maxReplicas int = 3

// --- Database ------------------------------------------------------------

param postgresAdminLogin string = 'attadmin'

@secure()
@minLength(12)
param postgresAdminPassword string

@allowed(['16', '17'])
param postgresVersion string = '16'

@description('Compute SKU, e.g. Standard_B1ms (Burstable) or Standard_D2ds_v5 (GeneralPurpose).')
param postgresSkuName string = 'Standard_B1ms'

@allowed(['Burstable', 'GeneralPurpose', 'MemoryOptimized'])
param postgresSkuTier string = 'Burstable'

param postgresStorageGB int = 32

param tags object = {
  app: 'academy'
}

// -------------------------------------------------------------------------

var suffix = take(uniqueString(resourceGroup().id, namePrefix), 8)
var compact = toLower(replace(namePrefix, '-', ''))
var names = {
  logs: '${namePrefix}-logs'
  identity: '${namePrefix}-id'
  acr: '${compact}acr${suffix}'
  storage: take('${compact}st${suffix}', 24)
  keyVault: take('${namePrefix}-kv-${suffix}', 24)
  postgres: '${namePrefix}-pg-${suffix}'
  env: '${namePrefix}-env'
  app: '${namePrefix}-app'
}
var databaseName = 'att'
var mediaContainer = 'media'
var bootstrap = empty(containerImage)

var roles = {
  acrPull: '7f951dda-4ed3-4680-a7ca-43fe172d538d'
  blobDataContributor: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
  keyVaultSecretsUser: '4633458b-17de-408a-b874-0445c86b69e6'
}

// --- Monitoring ----------------------------------------------------------

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: names.logs
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// --- Identity ------------------------------------------------------------

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: names.identity
  location: location
  tags: tags
}

// --- Container registry --------------------------------------------------

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: names.acr
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
    anonymousPullEnabled: false
  }
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: acr
  name: guid(acr.id, identity.id, roles.acrPull)
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.acrPull)
  }
}

// --- Storage -------------------------------------------------------------

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: names.storage
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    defaultToOAuthAuthentication: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    deleteRetentionPolicy: { enabled: true, days: 7 }
    containerDeleteRetentionPolicy: { enabled: true, days: 7 }
  }
}

resource media 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: mediaContainer
  properties: { publicAccess: 'None' }
}

resource blobContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storage
  name: guid(storage.id, identity.id, roles.blobDataContributor)
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.blobDataContributor)
  }
}

// --- PostgreSQL ----------------------------------------------------------

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: names.postgres
  location: location
  tags: tags
  sku: {
    name: postgresSkuName
    tier: postgresSkuTier
  }
  properties: {
    version: postgresVersion
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: postgresStorageGB
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: { mode: 'Disabled' }
    network: { publicNetworkAccess: 'Enabled' }
    authConfig: {
      activeDirectoryAuth: 'Disabled'
      passwordAuth: 'Enabled'
    }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Allows connections from Azure services (including Container Apps). TLS is enforced
// by the server. For network isolation, switch to VNet integration (see docs/DEPLOY.md).
resource allowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: postgres
  name: 'AllowAllAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// --- Key Vault -----------------------------------------------------------

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: names.keyVault
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 30
    publicNetworkAccess: 'Enabled'
  }
}

resource secretAuth 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'auth-secret'
  properties: { value: authSecret }
}

resource secretEntra 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'entra-client-secret'
  properties: { value: entraClientSecret }
}

var cronSecretValue = empty(cronSecret) ? '${uniqueString(authSecret, 'cron-1')}${uniqueString(authSecret, 'cron-2')}${uniqueString(authSecret, 'cron-3')}' : cronSecret

resource secretCron 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'cron-secret'
  properties: { value: cronSecretValue }
}

resource secretDb 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'database-url'
  properties: {
    value: 'postgresql://${postgresAdminLogin}:${uriComponent(postgresAdminPassword)}@${postgres.properties.fullyQualifiedDomainName}:5432/${databaseName}'
  }
}

resource vaultReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: vault
  name: guid(vault.id, identity.id, roles.keyVaultSecretsUser)
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsUser)
  }
}

// --- Container Apps ------------------------------------------------------

resource appEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: names.env
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

var port = bootstrap ? 80 : 3000

var probes = bootstrap
  ? []
  : [
      {
        type: 'Startup'
        httpGet: { path: '/api/health', port: port }
        initialDelaySeconds: 3
        periodSeconds: 5
        failureThreshold: 30 // allow up to ~2.5 min for first-run migrations
      }
      {
        type: 'Readiness'
        httpGet: { path: '/api/health', port: port }
        periodSeconds: 10
        failureThreshold: 3
      }
      {
        type: 'Liveness'
        httpGet: { path: '/api/health', port: port }
        periodSeconds: 30
        failureThreshold: 3
      }
    ]

var env = [
  { name: 'AUTH_SECRET', secretRef: 'auth-secret' }
  { name: 'AUTH_TRUST_HOST', value: 'true' }
  { name: 'AUTH_MICROSOFT_ENTRA_ID_ID', value: entraClientId }
  { name: 'AUTH_MICROSOFT_ENTRA_ID_SECRET', secretRef: 'entra-client-secret' }
  { name: 'AUTH_MICROSOFT_ENTRA_ID_ISSUER', value: '${environment().authentication.loginEndpoint}${entraTenantId}/v2.0' }
  { name: 'INITIAL_ADMIN_EMAILS', value: initialAdminEmails }
  { name: 'DATABASE_URL', secretRef: 'database-url' }
  { name: 'DATABASE_SSL', value: 'true' }
  { name: 'AZURE_STORAGE_ACCOUNT_URL', value: storage.properties.primaryEndpoints.blob }
  { name: 'AZURE_STORAGE_CONTAINER', value: mediaContainer }
  { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId }
  { name: 'APP_TIMEZONE', value: appTimezone }
  { name: 'APP_URL', value: appUrl }
  { name: 'CRON_SECRET', secretRef: 'cron-secret' }
  { name: 'MAIL_SENDER', value: mailSender }
  { name: 'ESCALATE_AFTER_DAYS', value: string(escalateAfterDays) }
]

// The app's public URL is known before it exists: <name>.<environment domain>.
var appUrl = 'https://${names.app}.${appEnv.properties.defaultDomain}'

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: names.app
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  properties: {
    environmentId: appEnv.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: port
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: identity.id
        }
      ]
      secrets: [
        { name: 'auth-secret', keyVaultUrl: secretAuth.properties.secretUri, identity: identity.id }
        { name: 'entra-client-secret', keyVaultUrl: secretEntra.properties.secretUri, identity: identity.id }
        { name: 'database-url', keyVaultUrl: secretDb.properties.secretUri, identity: identity.id }
        { name: 'cron-secret', keyVaultUrl: secretCron.properties.secretUri, identity: identity.id }
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: bootstrap ? 'mcr.microsoft.com/k8se/quickstart:latest' : containerImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: bootstrap ? [] : env
          probes: probes
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http'
            http: { metadata: { concurrentRequests: '50' } }
          }
        ]
      }
    }
  }
  dependsOn: [
    acrPull
    vaultReader
    blobContributor
    database
    allowAzure
  ]
}

// Daily reminders: a tiny scheduled job that calls the app's cron endpoint.
resource remindersJob 'Microsoft.App/jobs@2024-03-01' = if (!bootstrap) {
  name: take('${names.app}-reminders', 32)
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  properties: {
    environmentId: appEnv.id
    workloadProfileName: 'Consumption'
    configuration: {
      triggerType: 'Schedule'
      replicaTimeout: 300
      replicaRetryLimit: 2
      scheduleTriggerConfig: {
        cronExpression: remindersSchedule
        parallelism: 1
        replicaCompletionCount: 1
      }
      secrets: [
        { name: 'cron-secret', keyVaultUrl: secretCron.properties.secretUri, identity: identity.id }
      ]
    }
    template: {
      containers: [
        {
          name: 'reminders'
          image: 'docker.io/curlimages/curl:8.11.1'
          command: ['sh', '-c', 'curl -fsS --retry 3 --retry-delay 20 --max-time 240 -X POST -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/reminders"']
          env: [
            { name: 'CRON_SECRET', secretRef: 'cron-secret' }
            { name: 'APP_URL', value: appUrl }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
    }
  }
  dependsOn: [
    vaultReader
    app
  ]
}

// --- Outputs -------------------------------------------------------------

output appName string = app.name
output appFqdn string = app.properties.configuration.ingress.fqdn
output appUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
output redirectUri string = 'https://${app.properties.configuration.ingress.fqdn}/api/auth/callback/microsoft-entra-id'
output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output keyVaultName string = vault.name
output postgresFqdn string = postgres.properties.fullyQualifiedDomainName
output storageAccountName string = storage.name
output identityClientId string = identity.properties.clientId
output bootstrap bool = bootstrap
