using System.Text.Json;
using System.Text.Json.Nodes;
using EzDarts.Api.Games;
using EzDarts.Api.Http;
using EzDarts.Api.Stats;

namespace EzDarts.Api.Tests;

/// <summary>
/// The done-when of #20: the same games give the same stats rows here as in the browser. The web
/// app's <c>stats/rows.test.ts</c> checks its own numbers against the same two files.
/// </summary>
public class SharedStatsFixtureTests
{
    private static string Fixture(string name) =>
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "fixtures", name));

    private static IReadOnlyList<GameDto> Games() =>
        JsonSerializer.Deserialize<List<GameDto>>(Fixture("games.json"), ApiJson.Options)!;

    [Fact]
    public void EveryFixtureGameIsValid()
    {
        Assert.All(Games(), game => Assert.Null(GameValidator.Validate(game)));
    }

    [Fact]
    public void TheGamesAddUpToTheSameRowsAsInTheBrowser()
    {
        var totals = new Dictionary<StatsKey, StatsCounts>();
        foreach (var game in Games())
        {
            foreach (var (key, counts) in StatsContribution.Of(StatsSource.From(game)))
            {
                totals[key] = totals.TryGetValue(key, out var sum) ? sum.Plus(counts) : counts;
            }
        }

        // In RowKey order, as Table Storage lists them.
        var rows = totals
            .OrderBy(pair => pair.Key.RowKey, StringComparer.Ordinal)
            .Select(pair => new PlayerStatsDto(
                pair.Key.PlayerId, pair.Key.Game, pair.Key.Week, pair.Value.Games, pair.Value.Matches,
                pair.Value.Wins, pair.Value.Darts, pair.Value.Singles, pair.Value.Doubles, pair.Value.Triples,
                pair.Value.Misses, pair.Value.Points))
            .ToList();

        var actual = JsonSerializer.SerializeToNode(rows, ApiJson.Options);
        var expected = JsonNode.Parse(Fixture("rows.json"));
        Assert.True(
            JsonNode.DeepEquals(expected, actual),
            $"Expected {expected?.ToJsonString()}\nbut got {actual?.ToJsonString()}");
    }
}
