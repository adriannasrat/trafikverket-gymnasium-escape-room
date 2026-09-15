using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EscapeRoom.Api.Infrastructure.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260915090000_AddSessionPauseTracking")]
public partial class AddSessionPauseTracking : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "PausedAtUtc",
            table: "GameSessions",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<long>(
            name: "TotalPausedMilliseconds",
            table: "GameSessions",
            type: "bigint",
            nullable: false,
            defaultValue: 0L);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "PausedAtUtc",
            table: "GameSessions");

        migrationBuilder.DropColumn(
            name: "TotalPausedMilliseconds",
            table: "GameSessions");
    }
}
