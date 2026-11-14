using System.Globalization;
using System.Text.Json;
using EzDarts.Api.Http;

namespace EzDarts.Api.Games;

/// <summary>
/// Checks a game's shape before it is stored. The server never runs game rules, so this only makes
/// sure the record is well formed and only names players who are in it.
/// </summary>
public static class GameValidator
{
    public const int MaxSlots = 20;

    /// <returns>What is wrong, or <c>null</c> when the game can be stored.</returns>
    public static string? Validate(GameDto game)
    {
        if (!ApiJson.IsId(game.Id))
        {
            return "The game id must be letters, digits and dashes.";
        }

        if (string.IsNullOrWhiteSpace(game.Game) || game.Game.Length > 40 || !ApiJson.IsId(game.Game))
        {
            return "Unknown game type.";
        }

        if (game.ConfigVersion < 1)
        {
            return "configVersion must be 1 or more.";
        }

        if (game.Options.ValueKind != JsonValueKind.Object)
        {
            return "options must be an object.";
        }

        if (!IsTime(game.StartedAt))
        {
            return "startedAt must be an ISO 8601 time.";
        }

        return ValidateSlots(game.Slots) ?? ValidateDarts(game) ?? ValidateResult(game);
    }

    private static string? ValidateSlots(IReadOnlyList<SlotDto>? slots)
    {
        if (slots is null || slots.Count is 0 or > MaxSlots)
        {
            return $"A game needs 1 to {MaxSlots} players.";
        }

        if (slots.Any(s => !ApiJson.IsId(s.PlayerId) || (s.TeamId is not null && !ApiJson.IsId(s.TeamId))))
        {
            return "Player and team ids must be letters, digits and dashes.";
        }

        return slots.Select(s => s.PlayerId).Distinct().Count() == slots.Count
            ? null
            : "A player can only be in a game once.";
    }

    private static string? ValidateDarts(GameDto game)
    {
        if (game.Darts is null || game.Darts.Count > DartLog.MaxDarts)
        {
            return $"A game holds up to {DartLog.MaxDarts} darts.";
        }

        var players = game.Slots.Select(s => s.PlayerId).ToHashSet();
        foreach (var thrown in game.Darts)
        {
            if (thrown?.Dart is null || !players.Contains(thrown.PlayerId))
            {
                return "Every dart needs a player from the game.";
            }

            if (!IsValidDart(thrown.Dart))
            {
                return $"Invalid dart: segment {thrown.Dart.Segment} × {thrown.Dart.Multiplier}.";
            }
        }

        return null;
    }

    private static string? ValidateResult(GameDto game)
    {
        var players = game.Slots.Select(s => s.PlayerId).ToHashSet();
        if (game.Result is not null)
        {
            var standings = game.Result.Standings;
            if (!IsTime(game.Result.FinishedAt) || standings is null ||
                standings.Count != players.Count || !players.SetEquals(standings))
            {
                return "A result needs finishedAt and every player once in standings.";
            }
        }

        if (game.Summary is null)
        {
            return null;
        }

        if (game.Result is null)
        {
            return "Only a finished game has a summary.";
        }

        var valid = game.Summary.Count == players.Count &&
                    players.SetEquals(game.Summary.Select(s => s.PlayerId)) &&
                    game.Summary.All(s =>
                        s.Darts >= 0 && s.Singles >= 0 && s.Doubles >= 0 && s.Triples >= 0 && s.Misses >= 0 &&
                        s.Singles + s.Doubles + s.Triples + s.Misses == s.Darts &&
                        s.Place >= 1 && s.Place <= players.Count &&
                        s.Points is null or >= 0);
        return valid ? null : "The summary needs one entry per player with counts that add up.";
    }

    /// <summary>Same rules as the web app's <c>isValidDart</c>: no triple bull.</summary>
    public static bool IsValidDart(DartDto dart) => (dart.Segment, dart.Multiplier) switch
    {
        (0, 0) => true,
        (25, 1 or 2) => true,
        ( >= 1 and <= 20, >= 1 and <= 3) => true,
        _ => false,
    };

    private static bool IsTime(string? value) =>
        DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out _);
}
