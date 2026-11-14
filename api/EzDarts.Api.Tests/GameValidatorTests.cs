using System.Text.Json;
using EzDarts.Api.Games;
using static EzDarts.Api.Tests.TestRequests;

namespace EzDarts.Api.Tests;

public class GameValidatorTests
{
    [Fact]
    public void AcceptsAGameInPlayAndAFinishedOne()
    {
        Assert.Null(GameValidator.Validate(Game()));
        Assert.Null(GameValidator.Validate(Game(finished: true)));
    }

    [Fact]
    public void AcceptsTeamsAndPerPlayerOptions()
    {
        var options = JsonDocument.Parse("""{"startScore":301}""").RootElement;
        var game = Game() with { Slots = [new("anna", "A", options), new("oli", "B")] };

        Assert.Null(GameValidator.Validate(game));
    }

    public static TheoryData<string, GameDto> BadGames()
    {
        var game = Game();
        var finished = Game(finished: true);
        return new TheoryData<string, GameDto>
        {
            { "bad id", game with { Id = "a/b" } },
            { "no game type", game with { Game = "" } },
            { "config version", game with { ConfigVersion = 0 } },
            { "options not an object", game with { Options = JsonDocument.Parse("[]").RootElement } },
            { "startedAt", game with { StartedAt = "today" } },
            { "no players", game with { Slots = [], Darts = [] } },
            { "player twice", game with { Slots = [new("anna"), new("anna")] } },
            { "bad player id", game with { Slots = [new("anna"), new("o#li")], Darts = [] } },
            { "dart by a stranger", game with { Darts = [new("dagny", new DartDto(1, 1))] } },
            { "triple bull", game with { Darts = [new("anna", new DartDto(25, 3))] } },
            { "segment 21", game with { Darts = [new("anna", new DartDto(21, 1))] } },
            { "half a miss", game with { Darts = [new("anna", new DartDto(20, 0))] } },
            { "standings miss a player", finished with { Result = new(["anna"], "2026-11-14T21:00:00Z") } },
            { "finishedAt", finished with { Result = new(["anna", "oli"], "later") } },
            { "summary before the end", game with { Summary = finished.Summary } },
            { "summary misses a player", finished with { Summary = [finished.Summary![0]] } },
            {
                "summary counts don't add up",
                finished with { Summary = [finished.Summary![0] with { Darts = 3 }, finished.Summary[1]] }
            },
            {
                "place out of range",
                finished with { Summary = [finished.Summary![0] with { Place = 3 }, finished.Summary[1]] }
            },
        };
    }

    [Theory]
    [MemberData(nameof(BadGames))]
    public void RejectsBadGames(string why, GameDto game)
    {
        Assert.False(GameValidator.Validate(game) is null, why);
    }

    [Fact]
    public void RejectsTooManyDarts()
    {
        var darts = Enumerable.Repeat(new ThrownDartDto("anna", new DartDto(0, 0)), DartLog.MaxDarts + 1).ToList();

        Assert.NotNull(GameValidator.Validate(Game() with { Darts = darts }));
    }
}
