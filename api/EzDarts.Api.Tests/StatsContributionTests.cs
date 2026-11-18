using EzDarts.Api.Games;
using EzDarts.Api.Stats;
using static EzDarts.Api.Tests.TestRequests;

namespace EzDarts.Api.Tests;

public class StatsContributionTests
{
    private static StatsSource Finished(string finishedAt = "2026-11-14T21:00:00.000Z") =>
        StatsSource.From(Game(finished: true, finishedAt: finishedAt))!;

    [Fact]
    public void AGameInPlayCountsNothing()
    {
        Assert.Null(StatsSource.From(Game()));
        Assert.Empty(StatsContribution.Of(null));
    }

    [Fact]
    public void AFinishedGameCountsOnceForEachPlayer()
    {
        var counts = StatsContribution.Of(Finished());

        Assert.Equal(new StatsCounts(1, 1, 1, 2, 0, 0, 1, 1, 60), counts[new StatsKey("anna", "x01", "2026-W46")]);
        Assert.Equal(new StatsCounts(1, 1, 0, 0, 0, 0, 0, 0, 0), counts[new StatsKey("oli", "x01", "2026-W46")]);
    }

    [Fact]
    public void SoloPracticeIsAGameButNotAMatchOrAWin()
    {
        var solo = new StatsSource("x01", "2026-11-14T21:00:00Z", [new PlayerSummaryDto("anna", 9, 6, 2, 1, 0, 1, 301)]);

        Assert.Equal(new StatsCounts(1, 0, 0, 9, 6, 2, 1, 0, 301), StatsContribution.Of(solo)[new StatsKey("anna", "x01", "2026-W46")]);
    }

    [Fact]
    public void TeamMatesInFirstPlaceBothWin()
    {
        var teams = new StatsSource("x01", "2026-11-14T21:00:00Z",
        [
            new PlayerSummaryDto("anna", 3, 3, 0, 0, 0, 1, 60),
            new PlayerSummaryDto("bjorn", 3, 3, 0, 0, 0, 1, 41),
            new PlayerSummaryDto("oli", 3, 0, 0, 0, 3, 2, 0),
        ]);

        var counts = StatsContribution.Of(teams);

        Assert.Equal(1, counts[new StatsKey("anna", "x01", "2026-W46")].Wins);
        Assert.Equal(1, counts[new StatsKey("bjorn", "x01", "2026-W46")].Wins);
        Assert.Equal(0, counts[new StatsKey("oli", "x01", "2026-W46")].Wins);
        Assert.All(counts.Values, c => Assert.Equal(1, c.Matches));
    }

    [Fact]
    public void ComputersGetNoStatsButTheGameCountsForThePeople()
    {
        var game = new StatsSource("cricket", "2026-11-14T21:00:00Z",
        [
            new PlayerSummaryDto("anna", 3, 3, 0, 0, 0, 1, 40),
            new PlayerSummaryDto("computer-hard-1", 3, 3, 0, 0, 0, 1, 0),
            new PlayerSummaryDto("oli", 3, 0, 0, 0, 3, 2, 0),
            new PlayerSummaryDto("computer-easy-2", 3, 0, 0, 0, 3, 2, 0),
        ]);

        var counts = StatsContribution.Of(game);

        Assert.Equal(["anna", "oli"], counts.Keys.Select(k => k.PlayerId).Order());
        Assert.Equal(new StatsCounts(1, 1, 1, 3, 3, 0, 0, 0, 40), counts[new StatsKey("anna", "cricket", "2026-W46")]);
    }

    [Theory]
    [InlineData("computer-easy-1", true)]
    [InlineData("computer-hard-12", true)]
    [InlineData("computer-hard-0", false)]
    [InlineData("computer-expert-1", false)]
    [InlineData("anna", false)]
    public void IsComputer_ReadsTheId(string playerId, bool expected)
    {
        Assert.Equal(expected, StatsContribution.IsComputer(playerId));
    }

    [Fact]
    public void Delta_AddsAGameWhenItFinishes()
    {
        var delta = StatsContribution.Delta(null, Finished());

        Assert.Equal(2, delta.Count);
        Assert.Equal(1, delta[new StatsKey("anna", "x01", "2026-W46")].Wins);
    }

    [Fact]
    public void Delta_IsEmptyWhenTheSameGameIsSavedAgain()
    {
        Assert.Empty(StatsContribution.Delta(Finished(), Finished()));
    }

    [Fact]
    public void Delta_TakesAGameBackOutOnUndoOrDelete()
    {
        var delta = StatsContribution.Delta(Finished(), null);

        Assert.Equal(new StatsCounts(-1, -1, -1, -2, 0, 0, -1, -1, -60), delta[new StatsKey("anna", "x01", "2026-W46")]);
    }

    [Fact]
    public void Delta_MovesAGameToItsNewWeek()
    {
        var delta = StatsContribution.Delta(Finished(), Finished("2026-11-23T10:00:00Z"));

        Assert.Equal(-1, delta[new StatsKey("anna", "x01", "2026-W46")].Games);
        Assert.Equal(1, delta[new StatsKey("anna", "x01", "2026-W48")].Games);
    }

    [Theory]
    [InlineData("2026-11-14T21:00:00.000Z", "2026-W46")]
    // ISO weeks: 1 January 2026 is a Thursday, so 29 December 2025 starts 2026-W01.
    [InlineData("2025-12-29T08:00:00Z", "2026-W01")]
    [InlineData("2027-01-01T12:00:00Z", "2026-W53")]
    // Weeks follow UTC.
    [InlineData("2026-11-16T00:30:00+01:00", "2026-W46")]
    public void Week_IsTheIsoWeekInUtc(string finishedAt, string week)
    {
        Assert.Equal(week, StatsContribution.Week(finishedAt));
    }

    [Fact]
    public void StatsKey_RoundTripsThroughTheRowKey()
    {
        var key = new StatsKey("3f2a-9c", "around-the-world", "2026-W46");

        Assert.Equal("3f2a-9c|around-the-world|2026-W46", key.RowKey);
        Assert.Equal(key, StatsKey.FromRowKey(key.RowKey));
    }
}
