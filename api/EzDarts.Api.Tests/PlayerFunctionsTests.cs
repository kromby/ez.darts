using EzDarts.Api.Http;
using EzDarts.Api.Players;
using Microsoft.AspNetCore.Http;
using NSubstitute;
using static EzDarts.Api.Tests.TestRequests;

namespace EzDarts.Api.Tests;

public class PlayerFunctionsTests
{
    private readonly IPlayerStore _store = Substitute.For<IPlayerStore>();

    private PlayerFunctions Functions(bool signedIn = true) => new(Resolver(signedIn), _store);

    private void Existing(params PlayerDto[] players) =>
        _store.ListAsync(Household, Arg.Any<CancellationToken>()).Returns(players);

    [Fact]
    public async Task List_NeedsAHousehold()
    {
        var result = await Functions(signedIn: false).List(Empty(), CancellationToken.None);

        Assert.Equal(StatusCodes.Status401Unauthorized, Status(result));
        await _store.DidNotReceiveWithAnyArgs().ListAsync(default!, default);
    }

    [Fact]
    public async Task List_ReturnsTheHouseholdsPlayersByName()
    {
        Existing(new PlayerDto("2", "Óli"), new PlayerDto("1", "anna", "sky"), new PlayerDto("3", "Bjarni"));

        var (status, body) = Json<List<PlayerDto>>(await Functions().List(Empty(), CancellationToken.None));

        Assert.Equal(StatusCodes.Status200OK, status);
        Assert.Equal(["anna", "Bjarni", "Óli"], body.Select(p => p.Name));
    }

    [Fact]
    public async Task Put_NeedsAHousehold()
    {
        var result = await Functions(signedIn: false)
            .Put(WithJson(new PlayerDto("anna", "Anna")), "anna", CancellationToken.None);

        Assert.Equal(StatusCodes.Status401Unauthorized, Status(result));
        await _store.DidNotReceiveWithAnyArgs().UpsertAsync(default!, default!, default);
    }

    [Fact]
    public async Task Put_CreatesAPlayerWithATidyName()
    {
        Existing();
        _store.UpsertAsync(Household, Arg.Any<PlayerDto>(), Arg.Any<CancellationToken>()).Returns(true);

        var result = await Functions().Put(
            WithJson(new PlayerDto("anna", "  Anna   Jóns ", "red")), "anna", CancellationToken.None);

        var (status, body) = Json<PlayerDto>(result);
        Assert.Equal(StatusCodes.Status201Created, status);
        Assert.Equal(new PlayerDto("anna", "Anna Jóns", "red"), body);
        await _store.Received(1).UpsertAsync(Household, body, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Put_UpdatesAndArchives()
    {
        Existing(new PlayerDto("anna", "Anna"));
        _store.UpsertAsync(Household, Arg.Any<PlayerDto>(), Arg.Any<CancellationToken>()).Returns(false);
        var archived = new PlayerDto("anna", "Anna", "sky", "2026-11-14T20:00:00.000Z");

        var result = await Functions().Put(WithJson(archived), "anna", CancellationToken.None);

        Assert.Equal(StatusCodes.Status200OK, Status(result));
        await _store.Received(1).UpsertAsync(Household, archived, Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("óli")]
    [InlineData(" ÓLI ")]
    [InlineData("gunna")]
    public async Task Put_KeepsNamesUnique_RemovedPlayersIncluded(string name)
    {
        Existing(new PlayerDto("oli", "Óli"), new PlayerDto("gunna", "Gunna", ArchivedAt: "2026-11-01T20:00:00Z"));

        var result = await Functions().Put(WithJson(new PlayerDto("new", name)), "new", CancellationToken.None);

        Assert.Equal(StatusCodes.Status409Conflict, Status(result));
        await _store.DidNotReceiveWithAnyArgs().UpsertAsync(default!, default!, default);
    }

    [Fact]
    public async Task Put_LetsAPlayerKeepTheirOwnName()
    {
        Existing(new PlayerDto("oli", "Óli"));

        var result = await Functions().Put(
            WithJson(new PlayerDto("oli", "óli", "teal")), "oli", CancellationToken.None);

        Assert.NotEqual(StatusCodes.Status409Conflict, Status(result));
    }

    public static TheoryData<string, string> BadPlayers() => new()
    {
        // Body, URL id.
        { """{"id":"anna","name":"Anna"}""", "oli" },
        { """{"id":"a/b","name":"Anna"}""", "a/b" },
        { """{"id":"anna","name":"   "}""", "anna" },
        { $$"""{"id":"anna","name":"{{new string('a', PlayerFunctions.MaxNameLength + 1)}}"}""", "anna" },
        { """{"id":"anna","name":"Anna","color":"tartan"}""", "anna" },
        { """{"id":"anna","name":"Anna","archivedAt":"yesterday"}""", "anna" },
        { "not json", "anna" },
    };

    [Theory]
    [MemberData(nameof(BadPlayers))]
    public async Task Put_RejectsBadPlayers(string body, string id)
    {
        Existing();

        var result = await Functions().Put(WithText(body), id, CancellationToken.None);

        var (status, error) = Json<ErrorResponse>(result);
        Assert.Equal(StatusCodes.Status400BadRequest, status);
        Assert.NotEmpty(error.Error);
        await _store.DidNotReceiveWithAnyArgs().UpsertAsync(default!, default!, default);
    }
}
