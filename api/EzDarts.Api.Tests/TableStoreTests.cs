using Azure;
using Azure.Data.Tables;
using Azure.Data.Tables.Models;
using EzDarts.Api.Games;
using EzDarts.Api.Players;
using EzDarts.Api.Stats;
using EzDarts.Api.Storage;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using static EzDarts.Api.Tests.TestRequests;

namespace EzDarts.Api.Tests;

public class TableStoreTests
{
    private readonly TableServiceClient _service = Substitute.For<TableServiceClient>();
    private readonly TableClient _table = Substitute.For<TableClient>();
    private readonly TableProvider _tables;

    public TableStoreTests()
    {
        _service.GetTableClient(Arg.Any<string>()).Returns(_table);
        _tables = new TableProvider(_service);
    }

    private static NullableResponse<TableEntity> Missing()
    {
        var response = Substitute.For<NullableResponse<TableEntity>>();
        response.HasValue.Returns(false);
        return response;
    }

    private static NullableResponse<TableEntity> Found(TableEntity entity) =>
        Response.FromValue(entity, Substitute.For<Response>());

    [Fact]
    public async Task TableProvider_CreatesEachTableOnceAsync()
    {
        await _tables.GetAsync(TableProvider.Games, CancellationToken.None);
        await _tables.GetAsync(TableProvider.Games, CancellationToken.None);

        await _table.Received(1).CreateIfNotExistsAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TableProvider_TriesAgainAfterAFailedCreateAsync()
    {
        _table.CreateIfNotExistsAsync(Arg.Any<CancellationToken>())
            .Returns(_ => throw new RequestFailedException(503, "Busy"), _ => Substitute.For<Response<TableItem>>());

        await Assert.ThrowsAsync<RequestFailedException>(() =>
            _tables.GetAsync(TableProvider.Players, CancellationToken.None));
        await _tables.GetAsync(TableProvider.Players, CancellationToken.None);

        await _table.Received(2).CreateIfNotExistsAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public void GameEntity_RoundTrips()
    {
        var game = Game(finished: true);
        var applied = StatsSource.From(game);

        var entity = TableGameStore.Write(Household, game, applied);
        var read = TableGameStore.Read(entity);

        Assert.Equal(Household, entity.PartitionKey);
        Assert.Equal("game-1", entity.RowKey);
        Assert.Equal("0T20,0M", entity.GetString("Darts0"));
        Assert.True(entity.GetBoolean("Finished"));
        Assert.Equal(game.Darts, read.Game.Darts);
        Assert.Equal(game.Slots.Select(s => s.PlayerId), read.Game.Slots.Select(s => s.PlayerId));
        Assert.Equal(game.Result!.Standings, read.Game.Result!.Standings);
        Assert.Equal(game.Summary, read.Game.Summary);
        Assert.Equal(501, read.Game.Options.GetProperty("startScore").GetInt32());
        Assert.Equal(applied!.Summary, read.StatsApplied!.Summary);
    }

    [Fact]
    public void GameEntity_KeepsALongDartLogInChunks()
    {
        var darts = Enumerable.Range(0, 12_000)
            .Select(i => new ThrownDartDto(i % 2 == 0 ? "anna" : "oli", new DartDto(20, 3)))
            .ToList();
        var game = Game() with { Darts = darts };

        var entity = TableGameStore.Write(Household, game, null);

        Assert.True(entity.GetInt32("DartChunks") > 1);
        Assert.Equal(darts, TableGameStore.Read(entity).Game.Darts);
        Assert.Null(TableGameStore.Read(entity).Game.Result);
    }

    [Fact]
    public async Task PlayerStore_AddsANewPlayerAsync()
    {
        var created = await new TablePlayerStore(_tables)
            .UpsertAsync(Household, new PlayerDto("anna", "Anna", "sky"), CancellationToken.None);

        Assert.True(created);
        await _table.Received(1).AddEntityAsync(
            Arg.Is<TableEntity>(e => e.PartitionKey == Household && e.RowKey == "anna" && (string)e["Name"] == "Anna"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task PlayerStore_ReplacesAnExistingPlayerAsync()
    {
        _table.AddEntityAsync(Arg.Any<TableEntity>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new RequestFailedException(409, "Exists"));

        var created = await new TablePlayerStore(_tables)
            .UpsertAsync(Household, new PlayerDto("anna", "Anna"), CancellationToken.None);

        Assert.False(created);
        await _table.Received(1).UpsertEntityAsync(
            Arg.Is<TableEntity>(e => e.RowKey == "anna"), TableUpdateMode.Replace, Arg.Any<CancellationToken>());
    }

    private static readonly StatsKey AnnaX01 = new("anna", "x01", "2026-W46");
    private static readonly StatsCounts OneWin = new(1, 1, 2, 0, 0, 1, 1, 60);

    [Fact]
    public async Task StatsStore_AddsANewRowAsync()
    {
        var missing = Missing();
        _table.GetEntityIfExistsAsync<TableEntity>(Household, AnnaX01.RowKey, null, Arg.Any<CancellationToken>())
            .Returns(missing);

        await new TableStatsStore(_tables).ApplyAsync(
            Household, new Dictionary<StatsKey, StatsCounts> { [AnnaX01] = OneWin }, CancellationToken.None);

        await _table.Received(1).AddEntityAsync(
            Arg.Is<TableEntity>(e => e.RowKey == AnnaX01.RowKey && (int)e["Games"] == 1 && (int)e["Points"] == 60),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task StatsStore_AddsToAnExistingRowWithItsETagAsync()
    {
        var row = new TableEntity(Household, AnnaX01.RowKey) { ["Games"] = 4, ["Wins"] = 2, ETag = new ETag("v1") };
        _table.GetEntityIfExistsAsync<TableEntity>(Household, AnnaX01.RowKey, null, Arg.Any<CancellationToken>())
            .Returns(Found(row));

        await new TableStatsStore(_tables).ApplyAsync(
            Household, new Dictionary<StatsKey, StatsCounts> { [AnnaX01] = OneWin }, CancellationToken.None);

        await _table.Received(1).UpdateEntityAsync(
            Arg.Is<TableEntity>(e => (int)e["Games"] == 5 && (int)e["Wins"] == 3 && (int)e["Darts"] == 2),
            new ETag("v1"),
            TableUpdateMode.Replace,
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task StatsStore_ReadsAgainWhenAnotherSaveGotThereFirstAsync()
    {
        var first = new TableEntity(Household, AnnaX01.RowKey) { ["Games"] = 1, ETag = new ETag("v1") };
        var second = new TableEntity(Household, AnnaX01.RowKey) { ["Games"] = 2, ETag = new ETag("v2") };
        _table.GetEntityIfExistsAsync<TableEntity>(Household, AnnaX01.RowKey, null, Arg.Any<CancellationToken>())
            .Returns(Found(first), Found(second));
        _table.UpdateEntityAsync(Arg.Any<TableEntity>(), new ETag("v1"), TableUpdateMode.Replace,
                Arg.Any<CancellationToken>())
            .ThrowsAsync(new RequestFailedException(412, "Changed"));

        await new TableStatsStore(_tables).ApplyAsync(
            Household, new Dictionary<StatsKey, StatsCounts> { [AnnaX01] = OneWin }, CancellationToken.None);

        await _table.Received(1).UpdateEntityAsync(
            Arg.Is<TableEntity>(e => (int)e["Games"] == 3), new ETag("v2"), TableUpdateMode.Replace,
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task StatsStore_GivesUpAfterTooManyClashesAsync()
    {
        var missing = Missing();
        _table.GetEntityIfExistsAsync<TableEntity>(Household, AnnaX01.RowKey, null, Arg.Any<CancellationToken>())
            .Returns(missing);
        _table.AddEntityAsync(Arg.Any<TableEntity>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new RequestFailedException(409, "Exists"));

        await Assert.ThrowsAsync<InvalidOperationException>(() => new TableStatsStore(_tables).ApplyAsync(
            Household, new Dictionary<StatsKey, StatsCounts> { [AnnaX01] = OneWin }, CancellationToken.None));
        await _table.Received(TableStatsStore.MaxAttempts)
            .AddEntityAsync(Arg.Any<TableEntity>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task StatsStore_WritesNothingForNoChangeAsync()
    {
        await new TableStatsStore(_tables).ApplyAsync(
            Household, new Dictionary<StatsKey, StatsCounts>(), CancellationToken.None);

        Assert.Empty(_table.ReceivedCalls());
    }
}
