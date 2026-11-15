using System.Globalization;
using EzDarts.Api.Games;

namespace EzDarts.Api.Stats;

/// <summary>One stats row: a player's totals in one game type in one ISO week, e.g. 2026-W46.</summary>
public record StatsKey(string PlayerId, string Game, string Week)
{
    /// <summary>
    /// <c>{playerId}|{game}|{week}</c>; ids are letters, digits and dashes, so the parts never clash.
    /// </summary>
    public string RowKey => $"{PlayerId}|{Game}|{Week}";

    public static StatsKey FromRowKey(string rowKey)
    {
        var parts = rowKey.Split('|');
        return new StatsKey(parts[0], parts[1], parts[2]);
    }
}

/// <summary>
/// Plain sums, so a period's stats are rows added together, the same in the browser. <c>Matches</c>
/// are games against another side (not solo practice, not one team alone); only those can be won, so
/// the win ratio is wins over matches.
/// </summary>
public record StatsCounts(
    int Games,
    int Matches,
    int Wins,
    int Darts,
    int Singles,
    int Doubles,
    int Triples,
    int Misses,
    int Points)
{
    public static readonly StatsCounts Zero = new(0, 0, 0, 0, 0, 0, 0, 0, 0);

    public StatsCounts Plus(StatsCounts other) => new(
        Games + other.Games,
        Matches + other.Matches,
        Wins + other.Wins,
        Darts + other.Darts,
        Singles + other.Singles,
        Doubles + other.Doubles,
        Triples + other.Triples,
        Misses + other.Misses,
        Points + other.Points);

    public StatsCounts Negate() =>
        new(-Games, -Matches, -Wins, -Darts, -Singles, -Doubles, -Triples, -Misses, -Points);

    public bool IsZero => this == Zero;
}

/// <summary>A stats row as the API returns it.</summary>
public record PlayerStatsDto(
    string PlayerId,
    string Game,
    string Week,
    int Games,
    int Matches,
    int Wins,
    int Darts,
    int Singles,
    int Doubles,
    int Triples,
    int Misses,
    int Points);

/// <summary>
/// What a finished game counts in the stats: its type, when it finished and its summary. Stored with
/// the game once added, so a retried save knows what is already counted.
/// </summary>
public record StatsSource(string Game, string FinishedAt, IReadOnlyList<PlayerSummaryDto> Summary)
{
    /// <returns>The game's stats, or <c>null</c> until it is finished and has a summary.</returns>
    public static StatsSource? From(GameDto game) =>
        game.Result is null || game.Summary is null
            ? null
            : new StatsSource(game.Game, game.Result.FinishedAt, game.Summary);
}

public static class StatsContribution
{
    /// <summary>
    /// One game per player in the summary, in the ISO week the game finished. It is a match when
    /// someone finished behind first place, and a win for everyone in first place. The web app's
    /// <c>contribution</c> does the same.
    /// </summary>
    public static IReadOnlyDictionary<StatsKey, StatsCounts> Of(StatsSource? source)
    {
        if (source is null)
        {
            return new Dictionary<StatsKey, StatsCounts>();
        }

        var week = Week(source.FinishedAt);
        var match = source.Summary.Any(s => s.Place > 1) ? 1 : 0;
        return source.Summary.ToDictionary(
            s => new StatsKey(s.PlayerId, source.Game, week),
            s => new StatsCounts(
                1,
                match,
                s.Place == 1 ? match : 0,
                s.Darts,
                s.Singles,
                s.Doubles,
                s.Triples,
                s.Misses,
                s.Points ?? 0));
    }

    /// <summary>What changes when a game's stats go from <paramref name="before"/> to <paramref name="after"/>.</summary>
    public static IReadOnlyDictionary<StatsKey, StatsCounts> Delta(StatsSource? before, StatsSource? after)
    {
        var delta = new Dictionary<StatsKey, StatsCounts>();
        foreach (var (key, counts) in Of(before))
        {
            delta[key] = counts.Negate();
        }

        foreach (var (key, counts) in Of(after))
        {
            delta[key] = delta.TryGetValue(key, out var existing) ? existing.Plus(counts) : counts;
        }

        return delta.Where(pair => !pair.Value.IsZero).ToDictionary(pair => pair.Key, pair => pair.Value);
    }

    /// <summary>ISO 8601 week in UTC, e.g. <c>2026-W46</c>.</summary>
    public static string Week(string finishedAt)
    {
        var date = DateTimeOffset.Parse(finishedAt, CultureInfo.InvariantCulture).UtcDateTime;
        return string.Create(
            CultureInfo.InvariantCulture,
            $"{ISOWeek.GetYear(date)}-W{ISOWeek.GetWeekOfYear(date):00}");
    }
}
