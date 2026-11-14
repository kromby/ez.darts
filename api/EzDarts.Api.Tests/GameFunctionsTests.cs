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

    private void Stored(GameDto game, StatsSource? applied) =>
        _games.GetAsync(Household, game.Id, Arg.Any<CancellationToken>()).Returns(new StoredGame(game, applied));

    [Fact]
    public async Task EveryEndpoint_NeedsAHousehold()
    {
        var functions = Functions(signedIn: false);
        var token = CancellationToken.None;

        int[] statuses =
        [
            Status(await functions.List(Empty(), token)),
            Status(await functions.Get(Empty(), "game-1", token)),
            Status(await functions.Put(WithJson(Game()), "game-1", token)),
            Status(await functions.Delete(Empty(), "game-1", token)),
            Status(await new StatsFunctions(Resolver(false), _stats).Get(Empty(), token)),
        ];

        Assert.All(statuses, status => Assert.Equal(StatusCodes.Status401Unauthorized, status));
        Assert.Empty(_games.ReceivedCalls());
        Assert.Empty(_stats.ReceivedCalls());
    }

    [Fact]
    public async Task Put_CreatesAGameInPlayWithoutStats()
    {
        var game = Game();

        var result = await Functions().Put(WithJson(game), game.Id, CancellationToken.None);

        Assert.Equal(StatusCodes.Status201Created, Status(result));
        await _games.Received(1).SaveAsync(
            Household, Arg.Is<GameDto>(g => g.Id == game.Id && g.Darts.Count == 2), null, Arg.Any<CancellationToken>());
        Assert.Empty(_stats.ReceivedCalls());
    }

    [Fact]
    public async Task Put_AddsStatsWhenTheGameFinishes_ThenMarksThem()
    {
        var game = Game();
        Stored(game, null);
        var finished = Game(finished: true);

        var result = await Functions().Put(WithJson(finished), game.Id, CancellationToken.None);

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
                Household, game.Id, Arg.Is<StatsSource?>(s => s != null && s.Game == "x01"),
                Arg.Any<CancellationToken>());
        });
    }

    [Fact]
    public async Task Put_CountsAFinishedGameOnlyOnce()
    {
        var finished = Game(finished: true);
        Stored(finished, StatsSource.From(finished));

        var result = await Functions().Put(WithJson(finished), finished.Id, CancellationToken.None);

        Assert.Equal(StatusCodes.Status200OK, Status(result));
        await _games.Received(1).SaveAsync(
            Household, Arg.Any<GameDto>(), Arg.Is<StatsSource?>(s => s != null), Arg.Any<CancellationToken>());
        Assert.Empty(_stats.ReceivedCalls());
    }

    [Fact]
    public async Task Put_RetriedAfterAStatsFailure_CountsTheGameOnce()
    {
        // The first try saved the finished game but failed before its stats were marked.
        var finished = Game(finished: true);
        Stored(finished, null);

        await Functions().Put(WithJson(finished), finished.Id, CancellationToken.None);

        await _stats.Received(1).ApplyAsync(
            Household, Arg.Is<IReadOnlyDictionary<StatsKey, StatsCounts>>(d => d.Count == 2),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Put_TakesStatsBackOutWhenTheLastDartIsUndone()
    {
        var finished = Game(finished: true);
        Stored(finished, StatsSource.From(finished));

        await Functions().Put(WithJson(Game()), finished.Id, CancellationToken.None);

        await _stats.Received(1).ApplyAsync(
            Household,
            Arg.Is<IReadOnlyDictionary<StatsKey, StatsCounts>>(d => d.Values.All(c => c.Games == -1)),
            Arg.Any<CancellationToken>());
        await _games.Received(1).SetStatsAppliedAsync(Household, finished.Id, null, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Put_RejectsAMismatchedIdOrABadGame()
    {
        var mismatched = await Functions().Put(WithJson(Game("game-2")), "game-1", CancellationToken.None);
        var bad = await Functions().Put(
            WithJson(Game() with { Darts = [new("dagny", new DartDto(1, 1))] }), "game-1", CancellationToken.None);
        var notJson = await Functions().Put(WithText("{"), "game-1", CancellationToken.None);

        Assert.All([mismatched, bad, notJson], r =>
            Assert.Equal(StatusCodes.Status400BadRequest, Json<ErrorResponse>(r).Status));
        Assert.Empty(_games.ReceivedCalls());
    }

    [Fact]
    public async Task Get_ReturnsTheGameOr404()
    {
        var game = Game();
        Stored(game, null);

        var (status, body) = Json<GameDto>(await Functions().Get(Empty(), game.Id, CancellationToken.None));
        var missing = await Functions().Get(Empty(), "other", CancellationToken.None);

        Assert.Equal(StatusCodes.Status200OK, status);
        Assert.Same(game, body);
        Assert.Equal(StatusCodes.Status404NotFound, Status(missing));
    }

    [Fact]
    public async Task List_ReturnsTheHouseholdsGames()
    {
        IReadOnlyList<GameDto> list = [Game("b"), Game("a")];
        _games.ListAsync(Household, Arg.Any<CancellationToken>()).Returns(list);

        var (_, body) = Json<IReadOnlyList<GameDto>>(await Functions().List(Empty(), CancellationToken.None));

        Assert.Same(list, body);
    }

    [Fact]
    public async Task Delete_RemovesAGameInPlay()
    {
        Stored(Game(), null);

        var result = await Functions().Delete(Empty(), "game-1", CancellationToken.None);

        Assert.Equal(StatusCodes.Status204NoContent, Status(result));
        await _games.Received(1).DeleteAsync(Household, "game-1", Arg.Any<CancellationToken>());
        Assert.Empty(_stats.ReceivedCalls());
    }

    [Fact]
    public async Task Delete_TakesAFinishedGameOutOfTheStatsFirst()
    {
        var finished = Game(finished: true);
        Stored(finished, StatsSource.From(finished));

        await Functions().Delete(Empty(), finished.Id, CancellationToken.None);

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
    public async Task Delete_Returns404ForAnUnknownGame()
    {
        var result = await Functions().Delete(Empty(), "game-1", CancellationToken.None);

        Assert.Equal(StatusCodes.Status404NotFound, Status(result));
        await _games.DidNotReceiveWithAnyArgs().DeleteAsync(default!, default!, default);
    }

    [Fact]
    public async Task Stats_ReturnsTheHouseholdsRows()
    {
        IReadOnlyList<PlayerStatsDto> rows = [new("anna", "x01", "2026-W46", 1, 1, 2, 0, 0, 1, 1, 60)];
        _stats.ListAsync(Household, Arg.Any<CancellationToken>()).Returns(rows);

        var (_, body) = Json<IReadOnlyList<PlayerStatsDto>>(
            await new StatsFunctions(Resolver(), _stats).Get(Empty(), CancellationToken.None));

        Assert.Same(rows, body);
    }
}
