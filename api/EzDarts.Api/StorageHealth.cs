using Azure;
using Azure.Data.Tables;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace EzDarts.Api;

/// <summary>
/// Round-trips one fixed row through Table Storage to prove the API can write and read it.
/// Always the same row, so the table never grows no matter how often this is called.
/// </summary>
public class StorageHealth(TableServiceClient tableService)
{
    public const string TableName = "HealthCheck";
    public const string PartitionKey = "health";
    public const string RowKey = "probe";
    public const string ProbeProperty = "Probe";

    [Function("StorageHealth")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "health/storage")] HttpRequest req,
        CancellationToken cancellationToken)
    {
        var probe = Guid.NewGuid().ToString("N");
        try
        {
            var table = tableService.GetTableClient(TableName);
            await table.CreateIfNotExistsAsync(cancellationToken);
            await table.UpsertEntityAsync(
                new TableEntity(PartitionKey, RowKey) { [ProbeProperty] = probe },
                TableUpdateMode.Replace,
                cancellationToken);

            var readBack = await table.GetEntityAsync<TableEntity>(
                PartitionKey, RowKey, cancellationToken: cancellationToken);

            // A concurrent call can overwrite the row in between; that also reports unavailable.
            if (readBack.Value.GetString(ProbeProperty) != probe)
            {
                return Unavailable();
            }

            return new OkObjectResult(new StorageHealthResponse("ok", TableName, probe));
        }
        // AggregateException is what the SDK throws once its retries run out (e.g. unreachable endpoint).
        catch (Exception ex) when (ex is RequestFailedException or AggregateException)
        {
            return Unavailable();
        }
    }

    private static ObjectResult Unavailable() =>
        new(new StorageHealthResponse("unavailable", TableName, null))
        {
            StatusCode = StatusCodes.Status503ServiceUnavailable,
        };
}

public record StorageHealthResponse(string Status, string Table, string? Probe);
