using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace EzDarts.Api.Games;

/// <summary>
/// Stores a game's dart log compactly: each dart is the thrower's slot index and its notation,
/// e.g. <c>0T20,0S5,1M,1D25</c>, a few characters a dart instead of a JSON object with a UUID.
/// Long logs are split into chunks, as one Table Storage string holds at most 32K characters.
/// </summary>
public static partial class DartLog
{
    /// <summary>Characters per chunk, under the 32K-character property limit.</summary>
    public const int ChunkSize = 30_000;

    /// <summary>
    /// Well beyond any real game; keeps an entity far under Table Storage's 1 MB limit (at most
    /// 6 characters a dart, so 4 chunks).
    /// </summary>
    public const int MaxDarts = 20_000;

    public static string Encode(IReadOnlyList<ThrownDartDto> darts, IReadOnlyList<SlotDto> slots)
    {
        var builder = new StringBuilder(darts.Count * 5);
        for (var i = 0; i < darts.Count; i++)
        {
            if (i > 0)
            {
                builder.Append(',');
            }

            var thrown = darts[i];
            var slot = IndexOf(slots, thrown.PlayerId);
            builder.Append(slot.ToString(CultureInfo.InvariantCulture));
            var dart = thrown.Dart;
            if (dart.Multiplier == 0)
            {
                builder.Append('M');
            }
            else
            {
                builder.Append(dart.Multiplier switch { 1 => 'S', 2 => 'D', _ => 'T' });
                builder.Append(dart.Segment.ToString(CultureInfo.InvariantCulture));
            }
        }

        return builder.ToString();
    }

    public static IReadOnlyList<ThrownDartDto> Decode(string encoded, IReadOnlyList<SlotDto> slots)
    {
        if (encoded.Length == 0)
        {
            return [];
        }

        return encoded.Split(',').Select(part =>
        {
            var match = Code().Match(part);
            if (!match.Success)
            {
                throw new FormatException($"Bad dart '{part}' in a stored dart log.");
            }

            var slot = int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture);
            var kind = match.Groups[2].Value[0];
            var dart = kind == 'M'
                ? new DartDto(0, 0)
                : new DartDto(
                    int.Parse(match.Groups[3].Value, CultureInfo.InvariantCulture),
                    kind switch { 'S' => 1, 'D' => 2, _ => 3 });
            return new ThrownDartDto(slots[slot].PlayerId, dart);
        }).ToList();
    }

    public static IReadOnlyList<string> Chunk(string encoded)
    {
        var chunks = new List<string>();
        for (var start = 0; start < encoded.Length; start += ChunkSize)
        {
            chunks.Add(encoded.Substring(start, Math.Min(ChunkSize, encoded.Length - start)));
        }

        return chunks;
    }

    private static int IndexOf(IReadOnlyList<SlotDto> slots, string playerId)
    {
        for (var i = 0; i < slots.Count; i++)
        {
            if (slots[i].PlayerId == playerId)
            {
                return i;
            }
        }

        throw new ArgumentException($"Player {playerId} is not in the game.", nameof(playerId));
    }

    [GeneratedRegex("^([0-9]+)([SDTM])([0-9]*)$")]
    private static partial Regex Code();
}
