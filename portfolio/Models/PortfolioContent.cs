using System.Text.Json.Serialization;

namespace PortfolioSite.Models;

public sealed class PortfolioContent
{
    public ProfileContent Profile { get; set; } = new();
    public SectionContent Sections { get; set; } = new();
    public List<EducationItem> Education { get; set; } = [];
    public List<ExperienceItem> Experience { get; set; } = [];
    public List<string> Skills { get; set; } = [];
    public List<CertificationItem> Certifications { get; set; } = [];
    public List<ProjectItem> Projects { get; set; } = [];
    public AdminSeed Admin { get; set; } = new();
}

public sealed class ProfileContent
{
    public string Name { get; set; } = "";
    public string HeroTag { get; set; } = "";
    public string Title { get; set; } = "";
    public string Subtitle { get; set; } = "";
    public string ContactIntro { get; set; } = "";
    public string Email { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Location { get; set; } = "";
    public string Linkedin { get; set; } = "";
    public string ResumeUrl { get; set; } = "";
    public string ResumeFileName { get; set; } = "";
    public string PhotoUrl { get; set; } = "";
    public string PhotoFileName { get; set; } = "";
    public string Status { get; set; } = "";
    public List<HighlightItem> Highlights { get; set; } = [];
    public List<string> About { get; set; } = [];
}

public sealed class SectionContent
{
    public string AboutLabel { get; set; } = "";
    public string AboutTitle { get; set; } = "";
    public string ExperienceLabel { get; set; } = "";
    public string ExperienceTitle { get; set; } = "";
    public string SkillsLabel { get; set; } = "";
    public string SkillsTitle { get; set; } = "";
    public string ProjectsLabel { get; set; } = "";
    public string ProjectsTitle { get; set; } = "";
    public string ContactLabel { get; set; } = "";
    public string ContactTitle { get; set; } = "";
    public string CertLabel { get; set; } = "";
    public string CertTitle { get; set; } = "";
}

public sealed class HighlightItem
{
    public string Title { get; set; } = "";
    public string Text { get; set; } = "";
}

public sealed class EducationItem
{
    public string Institution { get; set; } = "";
    public string Degree { get; set; } = "";
    public string Period { get; set; } = "";
}

public sealed class ExperienceItem
{
    public string Title { get; set; } = "";
    public string Company { get; set; } = "";
    public string Location { get; set; } = "";
    public string Period { get; set; } = "";
    public List<string> Bullets { get; set; } = [];
}

public sealed class CertificationItem
{
    public string Name { get; set; } = "";
    public string Issuer { get; set; } = "";
    public string Date { get; set; } = "";
    public string Url { get; set; } = "";
}

public sealed class ProjectItem
{
    public string Tag { get; set; } = "";
    public string Title { get; set; } = "";
    public string Desc { get; set; } = "";
    public string Url { get; set; } = "";
}

public sealed class AdminSeed
{
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
}

public sealed class AdminAccount
{
    public string Username { get; set; } = "";
    public string Salt { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public int Iterations { get; set; } = 120_000;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class LoginRequest
{
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
}

public sealed class ChangePasswordRequest
{
    public string Username { get; set; } = "";
    public string CurrentPassword { get; set; } = "";
    public string NewPassword { get; set; } = "";
}

public sealed class AuthStatusResponse
{
    public bool Authenticated { get; set; }
    public string Username { get; set; } = "";
}
