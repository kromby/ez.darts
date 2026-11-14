using EzDarts.Api.Games;

namespace EzDarts.Api.Tests;

public class DartLogTests
{
    private static readonly IReadOnlyList<SlotDto> Slots = [new("anna"), new("oli")];

    [Fact]
    public void Encode_WritesSlotIndexAndNotation()
    {
        IReadOnlyList<ThrownDartDto> darts =
        [
            new("anna", new DartDto(20, 3)),
            new("anna", new DartDto(5, 1)),
            new("oli", new DartDto(0, 0)),
            new("oli", new DartDto(25, 2)),
        ];

        Assert.Equal("0T20,0S5,1M,1D25", DartLog.Encode(darts, Slots));
        Assert.Equal(darts, DartLog.Decode("0T20,0S5,1M,1D25", Slots));
    }

    [Fact]
    public void EmptyLog_RoundTrips()
    {
        Assert.Equal("", DartLog.Encode([], Slots));
        Assert.Empty(DartLog.Decode("", Slots));
    }

    [Fact]
    public void Encode_RefusesAPlayerNotInTheGame()
    {
        Assert.Throws<ArgumentException>(() =>
            DartLog.Encode([new ThrownDartDto("dagny", new DartDto(1, 1))], Slots));
    }

    [Theory]
    [InlineData("0X20")]
    [InlineData("T20")]
    [InlineData("0T20,,1M")]
    public void Decode_RefusesABadLog(string encoded)
    {
        Assert.Throws<FormatException>(() => DartLog.Decode(encoded, Slots));
    }

    [Fact]
    public void Chunk_SplitsLongLogsUnderTheTableLimit()
    {
        var darts = Enumerable.Range(0, DartLog.MaxDarts)
            .Select(i => new ThrownDartDto(i % 2 == 0 ? "anna" : "oli", new DartDto(20, 3)))
            .ToList();
        var encoded = DartLog.Encode(darts, Slots);

        var chunks = DartLog.Chunk(encoded);

        Assert.True(chunks.Count > 1);
        Assert.All(chunks, chunk => Assert.InRange(chunk.Length, 1, DartLog.ChunkSize));
        Assert.Equal(encoded, string.Concat(chunks));
        Assert.Equal(darts, DartLog.Decode(string.Concat(chunks), Slots));
    }

    [Fact]
    public void Chunk_HasNoChunksForNoDarts()
    {
        Assert.Empty(DartLog.Chunk(""));
    }
}
