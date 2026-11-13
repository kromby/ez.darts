using Azure;
using Azure.Data.Tables;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace EzDarts.Api.Tests;

public class StorageHealthTests
{
    private readonly TableServiceClient _service = Substitute.For<TableServiceClient>();
    private readonly TableClient _table = Substitute.For<TableClient>();

    public StorageHealthTests()
    {
        _service.GetTableClient(StorageHealth.TableName).Returns(_table);
    }

    [Fact]
    public async Task Run_WritesAndReadsBackTheProbeRow()
    {
        TableEntity? written = null;
        _table.UpsertEntityAsync(Arg.Do<TableEntity>(e => written = e), TableUpdateMode.Replace, Arg.Any<CancellationToken>())
            .Returns(Substitute.For<Response>());
        _table.GetEntityAsync<TableEntity>(StorageHealth.PartitionKey, StorageHealth.RowKey, null, Arg.Any<CancellationToken>())
            .Returns(_ => Response.FromValue(written!, Substitute.For<Response>()));

        var result = await new StorageHealth(_service).Run(new DefaultHttpContext().Request, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var body = Assert.IsType<StorageHealthResponse>(ok.Value);
        Assert.Equal("ok", body.Status);
        Assert.Equal(StorageHealth.TableName, body.Table);
        Assert.Equal(written!.GetString(StorageHealth.ProbeProperty), body.Probe);
        await _table.Received(1).CreateIfNotExistsAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Run_Returns503_WhenReadBackDoesNotMatch()
    {
        _table.UpsertEntityAsync(Arg.Any<TableEntity>(), TableUpdateMode.Replace, Arg.Any<CancellationToken>())
            .Returns(Substitute.For<Response>());
        var stale = new TableEntity(StorageHealth.PartitionKey, StorageHealth.RowKey)
        {
            [StorageHealth.ProbeProperty] = "something-else",
        };
        _table.GetEntityAsync<TableEntity>(StorageHealth.PartitionKey, StorageHealth.RowKey, null, Arg.Any<CancellationToken>())
            .Returns(Response.FromValue(stale, Substitute.For<Response>()));

        var result = await new StorageHealth(_service).Run(new DefaultHttpContext().Request, CancellationToken.None);

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, Assert.IsType<ObjectResult>(result).StatusCode);
    }

    public static TheoryData<Exception> StorageFailures() => new()
    {
        new RequestFailedException(403, "Forbidden"),
        // What the SDK throws once its retries run out, e.g. when the endpoint is unreachable.
        new AggregateException("Retry failed after 4 tries.", new RequestFailedException("Connection refused")),
    };

    [Theory]
    [MemberData(nameof(StorageFailures))]
    public async Task Run_Returns503_WhenStorageFails(Exception failure)
    {
        _table.CreateIfNotExistsAsync(Arg.Any<CancellationToken>()).ThrowsAsync(failure);

        var result = await new StorageHealth(_service).Run(new DefaultHttpContext().Request, CancellationToken.None);

        var error = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, error.StatusCode);
        Assert.Equal("unavailable", Assert.IsType<StorageHealthResponse>(error.Value).Status);
    }
}
