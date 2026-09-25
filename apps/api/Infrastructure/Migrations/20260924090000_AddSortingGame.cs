using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EscapeRoom.Api.Infrastructure.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260924090000_AddSortingGame")]
public partial class AddSortingGame : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "SortingCategory",
            table: "ChallengeOptions",
            type: "character varying(80)",
            maxLength: 80,
            nullable: true);

        migrationBuilder.AddColumn<long>(
            name: "CurrentChallengePenaltyMilliseconds",
            table: "GameSessions",
            type: "bigint",
            nullable: false,
            defaultValue: 0L);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "SortingCategory", table: "ChallengeOptions");
        migrationBuilder.DropColumn(name: "CurrentChallengePenaltyMilliseconds", table: "GameSessions");
    }
}
