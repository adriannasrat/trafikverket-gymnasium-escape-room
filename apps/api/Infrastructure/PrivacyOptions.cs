using EscapeRoom.Api.Domain;

namespace EscapeRoom.Api.Infrastructure;

public sealed class ExperienceOptions
{
    public ExperienceMode Mode { get; set; } = ExperienceMode.Event;
}

public sealed class DataRetentionOptions
{
    public const int DefaultRetentionDays = 30;

    public bool Enabled { get; set; } = true;
    public int RetentionDays { get; set; } = DefaultRetentionDays;
    public int CleanupIntervalHours { get; set; } = 6;
}
