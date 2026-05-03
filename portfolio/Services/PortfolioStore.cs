using System.Security.Cryptography;
using System.Text.Json;
using PortfolioSite.Models;

namespace PortfolioSite.Services;

public sealed class PortfolioStore
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        PropertyNameCaseInsensitive = true
    };

    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly string _contentPath;
    private readonly string _adminPath;
    private readonly string _seedPath;
    private readonly string _uploadRoot;

    public PortfolioStore(IWebHostEnvironment env)
    {
        var appDataRoot = Path.Combine(env.ContentRootPath, "App_Data");
        Directory.CreateDirectory(appDataRoot);

        _contentPath = Path.Combine(appDataRoot, "content.json");
        _adminPath = Path.Combine(appDataRoot, "admin.json");
        _uploadRoot = Path.Combine(appDataRoot, "uploads");
        _seedPath = Path.Combine(env.ContentRootPath, "portfolio.json");

        Directory.CreateDirectory(_uploadRoot);
    }

    public async Task InitializeAsync()
    {
        await _gate.WaitAsync();
        try
        {
            var seed = await LoadSeedAsync();

            if (!File.Exists(_contentPath))
            {
                Normalize(seed);
                seed.Admin = new AdminSeed
                {
                    Username = seed.Admin.Username,
                    Password = ""
                };
                await SaveAsync(_contentPath, seed);
            }

            if (!File.Exists(_adminPath))
            {
                var admin = CreateAdmin(seed.Admin.Username, seed.Admin.Password);
                await SaveAsync(_adminPath, admin);
            }
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<PortfolioContent> GetContentAsync()
    {
        await _gate.WaitAsync();
        try
        {
            var content = await LoadAsync<PortfolioContent>(_contentPath) ?? await LoadSeedAsync();
            Normalize(content);
            return content;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task SaveContentAsync(PortfolioContent content)
    {
        Normalize(content);
        content.Admin = new AdminSeed
        {
            Username = content.Admin.Username,
            Password = ""
        };
        await _gate.WaitAsync();
        try
        {
            await SaveAsync(_contentPath, content);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<AdminAccount> GetAdminAsync()
    {
        await _gate.WaitAsync();
        try
        {
            return (await LoadAsync<AdminAccount>(_adminPath)) ?? CreateAdmin("admin", "temp");
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task SaveAdminAsync(AdminAccount account)
    {
        await _gate.WaitAsync();
        try
        {
            await SaveAsync(_adminPath, account);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<(string url, string fileName)> SaveUploadAsync(IFormFile file, string folderName)
    {
        var extension = Path.GetExtension(file.FileName);
        var storedName = $"{RandomNumberGenerator.GetHexString(24)}{extension}";
        var targetFolder = Path.Combine(_uploadRoot, folderName);
        Directory.CreateDirectory(targetFolder);
        var targetPath = Path.Combine(targetFolder, storedName);

        await using var stream = File.Create(targetPath);
        await file.CopyToAsync(stream);

        return ($"/uploads/{folderName}/{storedName}", Path.GetFileName(file.FileName));
    }

    public static AdminAccount CreateAdmin(string username, string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var iterations = 120_000;
        var hash = HashPassword(password, salt, iterations);
        return new AdminAccount
        {
            Username = string.IsNullOrWhiteSpace(username) ? "admin" : username.Trim(),
            Salt = Convert.ToBase64String(salt),
            PasswordHash = Convert.ToBase64String(hash),
            Iterations = iterations,
            UpdatedAtUtc = DateTimeOffset.UtcNow
        };
    }

    public static bool VerifyPassword(AdminAccount account, string password)
    {
        var salt = Convert.FromBase64String(account.Salt);
        var expected = Convert.FromBase64String(account.PasswordHash);
        var actual = HashPassword(password, salt, account.Iterations);
        return CryptographicOperations.FixedTimeEquals(expected, actual);
    }

    private static byte[] HashPassword(string password, byte[] salt, int iterations)
    {
        return Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            iterations,
            HashAlgorithmName.SHA256,
            32);
    }

    private async Task<PortfolioContent> LoadSeedAsync()
    {
        var seed = await LoadAsync<PortfolioContent>(_seedPath) ?? new PortfolioContent();
        Normalize(seed);
        return seed;
    }

    private static void Normalize(PortfolioContent content)
    {
        content.Profile ??= new ProfileContent();
        content.Sections ??= new SectionContent();
        content.Education ??= [];
        content.Experience ??= [];
        content.Skills ??= [];
        content.Certifications ??= [];
        content.Projects ??= [];
        content.Admin ??= new AdminSeed();

        content.Profile.HeroTag = string.IsNullOrWhiteSpace(content.Profile.HeroTag) ? "Networking & Cybersecurity" : content.Profile.HeroTag;
        content.Profile.Title = string.IsNullOrWhiteSpace(content.Profile.Title) ? "IT Analyst & Networking / Cybersecurity Student" : content.Profile.Title;
        content.Profile.Subtitle = string.IsNullOrWhiteSpace(content.Profile.Subtitle) ? "Passionate about building secure, reliable infrastructure and solving complex technical challenges." : content.Profile.Subtitle;
        content.Profile.ContactIntro = string.IsNullOrWhiteSpace(content.Profile.ContactIntro) ? "I'm currently open to new opportunities in IT, networking, and cybersecurity. Whether you have a role to discuss or just want to connect, feel free to reach out." : content.Profile.ContactIntro;
        content.Profile.Status = string.IsNullOrWhiteSpace(content.Profile.Status) ? "Open to Opportunities" : content.Profile.Status;
        content.Profile.Highlights ??= [];
        content.Profile.About ??= [];

        content.Sections.AboutLabel = string.IsNullOrWhiteSpace(content.Sections.AboutLabel) ? "Who I Am" : content.Sections.AboutLabel;
        content.Sections.AboutTitle = string.IsNullOrWhiteSpace(content.Sections.AboutTitle) ? "About Me" : content.Sections.AboutTitle;
        content.Sections.ExperienceLabel = string.IsNullOrWhiteSpace(content.Sections.ExperienceLabel) ? "Career" : content.Sections.ExperienceLabel;
        content.Sections.ExperienceTitle = string.IsNullOrWhiteSpace(content.Sections.ExperienceTitle) ? "Experience" : content.Sections.ExperienceTitle;
        content.Sections.SkillsLabel = string.IsNullOrWhiteSpace(content.Sections.SkillsLabel) ? "Expertise" : content.Sections.SkillsLabel;
        content.Sections.SkillsTitle = string.IsNullOrWhiteSpace(content.Sections.SkillsTitle) ? "Skills" : content.Sections.SkillsTitle;
        content.Sections.ProjectsLabel = string.IsNullOrWhiteSpace(content.Sections.ProjectsLabel) ? "My Work" : content.Sections.ProjectsLabel;
        content.Sections.ProjectsTitle = string.IsNullOrWhiteSpace(content.Sections.ProjectsTitle) ? "Projects" : content.Sections.ProjectsTitle;
        content.Sections.ContactLabel = string.IsNullOrWhiteSpace(content.Sections.ContactLabel) ? "Let's Connect" : content.Sections.ContactLabel;
        content.Sections.ContactTitle = string.IsNullOrWhiteSpace(content.Sections.ContactTitle) ? "Contact" : content.Sections.ContactTitle;
        content.Sections.CertLabel = string.IsNullOrWhiteSpace(content.Sections.CertLabel) ? "Credentials" : content.Sections.CertLabel;
        content.Sections.CertTitle = string.IsNullOrWhiteSpace(content.Sections.CertTitle) ? "Certifications" : content.Sections.CertTitle;
    }

    private static async Task<T?> LoadAsync<T>(string path)
    {
        if (!File.Exists(path))
        {
            return default;
        }

        await using var stream = File.OpenRead(path);
        return await JsonSerializer.DeserializeAsync<T>(stream, JsonOptions);
    }

    private static async Task SaveAsync<T>(string path, T value)
    {
        await using var stream = File.Create(path);
        await JsonSerializer.SerializeAsync(stream, value, JsonOptions);
    }
}
