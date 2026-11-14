using Azure.Data.Tables;
using Azure.Monitor.OpenTelemetry.Exporter;
using EzDarts.Api.Games;
using EzDarts.Api.Households;
using EzDarts.Api.Players;
using EzDarts.Api.Stats;
using EzDarts.Api.Storage;
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

// Who is signed in. Sign-in (#19) registers its session-cookie resolver here instead. Until then no
// request has a household, except under `func start` (which sets AZURE_FUNCTIONS_ENVIRONMENT to
// Development; Azure does not), where an X-Household-Id header stands in for one.
if (string.Equals(
        Environment.GetEnvironmentVariable("AZURE_FUNCTIONS_ENVIRONMENT"),
        "Development",
        StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddSingleton<IHouseholdResolver, DevHeaderHouseholdResolver>();
}
else
{
    builder.Services.AddSingleton<IHouseholdResolver, NoSessionHouseholdResolver>();
}

if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("APPLICATIONINSIGHTS_CONNECTION_STRING")))
{
    builder.Services.AddOpenTelemetry()
        .UseFunctionsWorkerDefaults()
        .UseAzureMonitorExporter();
}

builder.Build().Run();
