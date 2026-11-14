using Azure.Data.Tables;
using Azure.Monitor.OpenTelemetry.Exporter;
using EzDarts.Api.Accounts;
using EzDarts.Api.Games;
using EzDarts.Api.Households;
using EzDarts.Api.Players;
using EzDarts.Api.Stats;
using EzDarts.Api.Storage;
using Microsoft.AspNetCore.Identity;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Azure.Functions.Worker.OpenTelemetry;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using OpenTelemetry;

var builder = FunctionsApplication.CreateBuilder(args);

builder.ConfigureFunctionsWebApplication();

builder.Services.AddSingleton(_ =>
{
    var connectionString = builder.Configuration["StorageConnectionString"];
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        throw new InvalidOperationException(
            "App setting 'StorageConnectionString' is missing. Locally, copy local.settings.example.json to local.settings.json.");
    }

    return new TableServiceClient(connectionString);
});

builder.Services.AddSingleton<TableProvider>();
builder.Services.AddSingleton<IPlayerStore, TablePlayerStore>();
builder.Services.AddSingleton<IGameStore, TableGameStore>();
builder.Services.AddSingleton<IStatsStore, TableStatsStore>();

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IPasswordHasher<UserRecord>, PasswordHasher<UserRecord>>();
builder.Services.AddSingleton<IUserStore, TableUserStore>();
builder.Services.AddSingleton<ISessionStore, TableSessionStore>();
builder.Services.AddSingleton<ILoginAttemptStore, TableLoginAttemptStore>();
builder.Services.AddSingleton<AccountService>();
builder.Services.AddSingleton<SessionHouseholdResolver>();

// Who is signed in: the session cookie. Under `func start` (which sets AZURE_FUNCTIONS_ENVIRONMENT to
// Development; Azure does not), an X-Household-Id header also works, to try the API without signing in.
if (string.Equals(
        Environment.GetEnvironmentVariable("AZURE_FUNCTIONS_ENVIRONMENT"),
        "Development",
        StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddSingleton<IHouseholdResolver>(services => new FirstHouseholdResolver(
        services.GetRequiredService<SessionHouseholdResolver>(),
        new DevHeaderHouseholdResolver()));
}
else
{
    builder.Services.AddSingleton<IHouseholdResolver>(services =>
        services.GetRequiredService<SessionHouseholdResolver>());
}

if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING")))
{
    builder.Services.AddOpenTelemetry()
        .UseFunctionsWorkerDefaults()
        .UseAzureMonitorExporter();
}

builder.Build().Run();
