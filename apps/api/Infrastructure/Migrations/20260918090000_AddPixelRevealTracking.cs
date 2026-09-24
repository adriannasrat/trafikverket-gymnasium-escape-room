using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EscapeRoom.Api.Infrastructure.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260918090000_AddPixelRevealTracking")]
public partial class AddPixelRevealTracking : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "PixelRevealCount",
            table: "GameSessions",
            type: "integer",
            nullable: false,
            defaultValue: 0);

        migrationBuilder.AddColumn<long>(
            name: "TotalPenaltyMilliseconds",
            table: "GameSessions",
            type: "bigint",
            nullable: false,
            defaultValue: 0L);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "PixelRevealCount", table: "GameSessions");
        migrationBuilder.DropColumn(name: "TotalPenaltyMilliseconds", table: "GameSessions");
    }
}
