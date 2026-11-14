using System.Text.Json;

namespace EzDarts.Api.Games;

/// <summary>0 = miss; 1–20 and 25 (bull) are board segments.</summary>
public record DartDto(int Segment, int Multiplier);

public record ThrownDartDto(string PlayerId, DartDto Dart);

/// <summary>A player's place in the game, in throwing order. Options are the game's own, kept as sent.</summary>
public record SlotDto(string PlayerId, string? TeamId = null, JsonElement? Options = null);

public record GameResultDto(IReadOnlyList<string> Standings, string FinishedAt);

/// <summary>
/// One player's numbers from a finished game, worked out by the web app (the server never runs game
/// rules): darts thrown, where they landed (a bull is a single, the bullseye a double), the place
/// (team mates share one, 1 is first) and, for x01 only, the points scored (busts score nothing).
/// </summary>
public record PlayerSummaryDto(
    string PlayerId,
    int Darts,
    int Singles,
    int Doubles,
    int Triples,
    int Misses,
    int Place,
    int? Points = null);

/// <summary>A game as the web app's <c>GameRecord</c>, plus the per-player summary once finished.</summary>
public record GameDto(
    string Id,
    string Game,
    int ConfigVersion,
    JsonElement Options,
    IReadOnlyList<SlotDto> Slots,
    IReadOnlyList<ThrownDartDto> Darts,
    string StartedAt,
    GameResultDto? Result = null,
    IReadOnlyList<PlayerSummaryDto>? Summary = null);
