using EzDarts.Api.Games;
using EzDarts.Api.Http;
using EzDarts.Api.Stats;
using Microsoft.AspNetCore.Http;
using NSubstitute;
using static EzDarts.Api.Tests.TestRequests;

namespace EzDarts.Api.Tests;

public class GameFunctionsTests
{
    private readonly IGameStore _games = Substitute.For<IGameStore>();
    private readonly IStatsStore _stats = Substitute.For<IStatsStore>();

    private GameFunctions Functions(bool signedIn = true) => new(Resolver(signedIn), _games, _stats);

    private static bool IsX01(StatsSource? source) => source?.Game == "x01";

    private void Stored(GameDto game, StatsSource? applied) =>
        _games.GetAsync(Household, game.Id, Arg.Any<CancellationToken>()).Returns(new StoredGame(game, applied));

    [Fact]
    public async Task EveryEndpoint_NeedsAHouseholdAsync()
    {
        var functions = Functions(signedIn: false);
        var token = CancellationToken.None;

        int[] statuses =
        [
            Status(await functions.ListAsync(Empty(), token)),
            Status(await functions.GetAsync(Empty(), "game-1", token)),
            Status(await functions.PutAsync(WithJson(Game()), "game-1", token)),
            Status(await functions.DeleteAsync(Empty(), "game-1", token)),
            Status(await new StatsFunctions(Resolver(false), _stats).GetAsync(Empty(), token)),
        ];

        Assert.All(statuses, status => Assert.Equal(StatusCodes.Status401Unauthorized, status));
        Assert.Empty(_games.ReceivedCalls());
        Assert.Empty(_stats.ReceivedCalls());
    }

    [Fact]
    public async Task Put_CreatesAGameInPlayWithoutStatsAsync()
    {
        var game = Game();

        var result = await Functions().PutAsync(WithJson(game), game.Id, CancellationToken.None);

        Assert.Equal(StatusCodes.Status201Created, Status(result));
        await _games.Received(1).SaveAsync(
            Household, Arg.Is<GameDto>(g => g.Id == game.Id && g.Darts.Count == 2), null, Arg.Any<CancellationToken>());
        Assert.Empty(_stats.ReceivedCalls());
    }

    [Fact]
    public async Task Put_AddsStatsWhenTheGameFinishes_ThenMarksThemAsync()
    {
        var game = Game();
        Stored(game, null);
        var finished = Game(finished: true);

        var result = await Functions().PutAsync(WithJson(finished), game.Id, CancellationToken.None);

        Assert.Equal(StatusCodes.Status200OK, Status(result));
        Received.InOrder(() =>
        {
            _games.SaveAsync(Household, Arg.Any<GameDto>(), null, Arg.Any<CancellationToken>());
            _stats.ApplyAsync(
                Household,
                Arg.Is<IReadOnlyDictionary<StatsKey, StatsCounts>>(d =>
                    d.Count == 2 && d[new StatsKey("anna", "x01", "2026-W46")].Wins == 1),
                Arg.Any<CancellationToken>());
            _games.SetStatsAppliedAsync(
                Household, game.Id, Arg.Is<StatsSource?>(s => IsX01(s)),
                Arg.Any<CancellationToken>());
        });
    }

    [Fact]
    public async Task Put_CountsAFinishedGameOnlyOnceAsync()
    {
        var finished = Game(finished: true);
        Stored(finished, StatsSource.From(finished));

        var result = await Functions().PutAsync(WithJson(finished), finished.Id, CancellationToken.None);

        Assert.Equal(StatusCodes.Status200OK, Status(result));
        await _games.Received(1).SaveAsync(
            Household, Arg.Any<GameDto>(), Arg.Is<StatsSource?>(s => s != null), Arg.Any<CancellationToken>());
        Assert.Empty(_stats.ReceivedCalls());
    }

    [Fact]
    public async Task Put_RetriedAfterAStatsFailure_CountsTheGameOnceAsync()
    {
        // The first try saved the finished game but failed before its stats were marked.
        var finished = Game(finished: true);
        Stored(finished, null);

        await Functions().PutAsync(WithJson(finished), finished.Id, CancellationToken.None);

        await _stats.Received(1).ApplyAsync(
            Household, Arg.Is<IReadOnlyDictionary<StatsKey, StatsCounts>>(d => d.Count == 2),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Put_TakesStatsBackOutWhenTheLastDartIsUndoneAsync()
    {
        var finished = Game(finished: true);
        Stored(finished, StatsSource.From(finished));

        await Functions().PutAsync(WithJson(Game()), finished.Id, CancellationToken.None);

        await _stats.Received(1).ApplyAsync(
            Household,
            Arg.Is<IReadOnlyDictionary<StatsKey, StatsCounts>>(d => d.Values.All(c => c.Games == -1)),
            Arg.Any<CancellationToken>());
        await _games.Received(1).SetStatsAppliedAsync(Household, finished.Id, null, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Put_RejectsAMismatchedIdOrABadGameAsync()
    {
        var mismatched = await Functions().PutAsync(WithJson(Game("game-2")), "game-1", CancellationToken.None);
        var bad = await Functions().PutAsync(
            WithJson(Game() with { Darts = [new("dagny", new DartDto(1, 1))] }), "game-1", CancellationToken.None);
        var notJson = await Functions().PutAsync(WithText("{"), "game-1", CancellationToken.None);

        Assert.All([mismatched, bad, notJson], r =>
            Assert.Equal(StatusCodes.Status400BadRequest, Json<ErrorResponse>(r).Status));
        Assert.Empty(_games.ReceivedCalls());
    }

    [Fact]
    public async Task Get_ReturnsTheGameOr404Async()
    {
        var game = Game();
        Stored(game, null);

        var (status, body) = Json<GameDto>(await Functions().GetAsync(Empty(), game.Id, CancellationToken.None));
        var missing = await Functions().GetAsync(Empty(), "other", CancellationToken.None);

        Assert.Equal(StatusCodes.Status200OK, status);
        Assert.Same(game, body);
        Assert.Equal(StatusCodes.Status404NotFound, Status(missing));
    }

    [Fact]
    public async Task List_ReturnsTheHouseholdsGamesAsync()
    {
        IReadOnlyList<GameDto> list = [Game("b"), Game("a")];
        _games.ListAsync(Household, Arg.Any<CancellationToken>()).Returns(list);

        var (_, body) = Json<IReadOnlyList<GameDto>>(await Functions().ListAsync(Empty(), CancellationToken.None));

        Assert.Same(list, body);
    }

    [Fact]
    public async Task Delete_RemovesAGameInPlayAsync()
    {
        Stored(Game(), null);

        var result = await Functions().DeleteAsync(Empty(), "game-1", CancellationToken.None);

        Assert.Equal(StatusCodes.Status204NoContent, Status(result));
        await _games.Received(1).DeleteAsync(Household, "game-1", Arg.Any<CancellationToken>());
        Assert.Empty(_stats.ReceivedCalls());
    }

    [Fact]
    public async Task Delete_TakesAFinishedGameOutOfTheStatsFirstAsync()
    {
        var finished = Game(finished: true);
        Stored(finished, StatsSource.From(finished));

        await Functions().DeleteAsync(Empty(), finished.Id, CancellationToken.None);

        Received.InOrder(() =>
        {
            _stats.ApplyAsync(
                Household,
                Arg.Is<IReadOnlyDictionary<StatsKey, StatsCounts>>(d => d.Values.All(c => c.Games == -1)),
                Arg.Any<CancellationToken>());
            _games.SetStatsAppliedAsync(Household, finished.Id, null, Arg.Any<CancellationToken>());
            _games.DeleteAsync(Household, finished.Id, Arg.Any<CancellationToken>());
        });
    }

    [Fact]
    public async Task Delete_Returns404ForAnUnknownGameAsync()
    {
        var result = await Functions().DeleteAsync(Empty(), "game-1", CancellationToken.None);

        Assert.Equal(StatusCodes.Status404NotFound, Status(result));
        await _games.DidNotReceiveWithAnyArgs().DeleteAsync(default!, default!, default);
    }

    [Fact]
    public async Task Stats_ReturnsTheHouseholdsRowsAsync()
    {
        IReadOnlyList<PlayerStatsDto> rows = [new("anna", "x01", "2026-W46", 1, 1, 1, 2, 0, 0, 1, 1, 60)];
        _stats.ListAsync(Household, Arg.Any<CancellationToken>()).Returns(rows);

        var (_, body) = Json<IReadOnlyList<PlayerStatsDto>>(
            await new StatsFunctions(Resolver(), _stats).GetAsync(Empty(), CancellationToken.None));

        Assert.Same(rows, body);
    }
}
