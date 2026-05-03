using System.Security.Claims;
using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.FileProviders;
using PortfolioSite.Models;
using PortfolioSite.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.PropertyNameCaseInsensitive = true;
    options.SerializerOptions.WriteIndented = false;
});

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 15 * 1024 * 1024;
});

builder.Services.AddSingleton<PortfolioStore>();
builder.Services.AddAuthorization();
builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "Portfolio.Auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.Events = new CookieAuthenticationEvents
        {
            OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            },
            OnRedirectToAccessDenied = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("login", httpContext =>
    {
        var key = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromMinutes(5),
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 0
        });
    });
});

var app = builder.Build();
var store = app.Services.GetRequiredService<PortfolioStore>();
await store.InitializeAsync();

var rootProvider = new PhysicalFileProvider(app.Environment.ContentRootPath);
var uploadProvider = new PhysicalFileProvider(Path.Combine(app.Environment.ContentRootPath, "App_Data", "uploads"));

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Content-Security-Policy"] =
        "default-src 'self'; " +
        "img-src 'self' data: https://fonts.gstatic.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "script-src 'self'; " +
        "connect-src 'self'; " +
        "frame-ancestors 'none';";
    await next();
});

app.UseHttpsRedirection();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.UseDefaultFiles(new DefaultFilesOptions
{
    FileProvider = rootProvider,
    DefaultFileNames = { "index.html" }
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = rootProvider
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = uploadProvider,
    RequestPath = "/uploads",
    ServeUnknownFileTypes = false
});

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.MapGet("/api/content", async () =>
{
    var content = await store.GetContentAsync();
    content.Admin = new AdminSeed();
    return Results.Ok(content);
});

app.MapGet("/api/auth/csrf", (HttpContext context) =>
{
    var token = CreateCsrfToken();
    WriteCsrfCookie(context, token, app.Environment.IsDevelopment());
    return Results.Ok(new { token });
});

app.MapGet("/api/auth/me", (HttpContext context) =>
{
    return Results.Ok(new AuthStatusResponse
    {
        Authenticated = context.User.Identity?.IsAuthenticated ?? false,
        Username = context.User.Identity?.IsAuthenticated == true ? context.User.Identity?.Name ?? "" : ""
    });
});

app.MapPost("/api/auth/login", [EnableRateLimiting("login")] async (HttpContext context, LoginRequest request) =>
{
    if (!ValidateCsrf(context))
    {
        return Results.BadRequest(new { message = "Invalid CSRF token." });
    }

    var admin = await store.GetAdminAsync();
    if (!string.Equals(admin.Username, request.Username?.Trim(), StringComparison.Ordinal) ||
        !PortfolioStore.VerifyPassword(admin, request.Password ?? ""))
    {
        return Results.BadRequest(new { message = "Invalid username or password." });
    }

    var claims = new List<Claim>
    {
        new(ClaimTypes.Name, admin.Username),
        new(ClaimTypes.Role, "Admin")
    };

    var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
    var principal = new ClaimsPrincipal(identity);

    await context.SignInAsync(
        CookieAuthenticationDefaults.AuthenticationScheme,
        principal,
        new AuthenticationProperties
        {
            IsPersistent = false,
            AllowRefresh = true,
            IssuedUtc = DateTimeOffset.UtcNow,
            ExpiresUtc = DateTimeOffset.UtcNow.AddHours(8)
        });

    var token = CreateCsrfToken();
    WriteCsrfCookie(context, token, app.Environment.IsDevelopment());

    return Results.Ok(new AuthStatusResponse
    {
        Authenticated = true,
        Username = admin.Username
    });
});

app.MapPost("/api/auth/logout", async (HttpContext context) =>
{
    if (!ValidateCsrf(context))
    {
        return Results.BadRequest(new { message = "Invalid CSRF token." });
    }

    await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    context.Response.Cookies.Delete("Portfolio.Csrf");
    return Results.Ok(new { ok = true });
});

var adminGroup = app.MapGroup("/api/admin").RequireAuthorization(new AuthorizeAttribute
{
    Roles = "Admin"
});

adminGroup.MapPut("/content", async (HttpContext context, PortfolioContent incoming) =>
{
    if (!ValidateCsrf(context))
    {
        return Results.BadRequest(new { message = "Invalid CSRF token." });
    }

    var existing = await store.GetContentAsync();
    incoming.Admin = existing.Admin;
    await store.SaveContentAsync(incoming);
    incoming.Admin = new AdminSeed();
    return Results.Ok(incoming);
});

adminGroup.MapPost("/uploads/photo", async (HttpContext context, IFormFile file) =>
{
    if (!ValidateCsrf(context))
    {
        return Results.BadRequest(new { message = "Invalid CSRF token." });
    }

    if (file.Length == 0 || file.Length > 5 * 1024 * 1024)
    {
        return Results.BadRequest(new { message = "Photo must be between 1 byte and 5 MB." });
    }

    var allowedTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif"
    };

    if (!allowedTypes.Contains(file.ContentType))
    {
        return Results.BadRequest(new { message = "Only PNG, JPG, WEBP, or GIF images are allowed." });
    }

    var upload = await store.SaveUploadAsync(file, "photos");
    return Results.Ok(new { url = upload.url, fileName = upload.fileName });
});

adminGroup.MapPost("/uploads/resume", async (HttpContext context, IFormFile file) =>
{
    if (!ValidateCsrf(context))
    {
        return Results.BadRequest(new { message = "Invalid CSRF token." });
    }

    if (file.Length == 0 || file.Length > 10 * 1024 * 1024)
    {
        return Results.BadRequest(new { message = "Resume must be between 1 byte and 10 MB." });
    }

    var extension = Path.GetExtension(file.FileName);
    if (!string.Equals(file.ContentType, "application/pdf", StringComparison.OrdinalIgnoreCase) &&
        !string.Equals(extension, ".pdf", StringComparison.OrdinalIgnoreCase))
    {
        return Results.BadRequest(new { message = "Only PDF resumes are allowed." });
    }

    var upload = await store.SaveUploadAsync(file, "resumes");
    return Results.Ok(new { url = upload.url, fileName = upload.fileName });
});

adminGroup.MapPost("/password", async (HttpContext context, ChangePasswordRequest request) =>
{
    if (!ValidateCsrf(context))
    {
        return Results.BadRequest(new { message = "Invalid CSRF token." });
    }

    var current = await store.GetAdminAsync();
    if (!string.Equals(current.Username, request.Username?.Trim(), StringComparison.Ordinal) ||
        !PortfolioStore.VerifyPassword(current, request.CurrentPassword ?? ""))
    {
        return Results.BadRequest(new { message = "Current credentials are incorrect." });
    }

    var trimmedUsername = request.Username?.Trim() ?? "";
    var nextPassword = string.IsNullOrWhiteSpace(request.NewPassword)
        ? request.CurrentPassword ?? ""
        : request.NewPassword;

    if (!string.IsNullOrWhiteSpace(request.NewPassword) && !IsStrongPassword(request.NewPassword))
    {
        return Results.BadRequest(new { message = "Use a stronger password: at least 12 characters with uppercase, lowercase, number, and symbol." });
    }

    var updated = PortfolioStore.CreateAdmin(trimmedUsername, nextPassword);
    await store.SaveAdminAsync(updated);
    var content = await store.GetContentAsync();
    content.Admin.Username = updated.Username;
    await store.SaveContentAsync(content);

    var claims = new List<Claim>
    {
        new(ClaimTypes.Name, updated.Username),
        new(ClaimTypes.Role, "Admin")
    };

    await context.SignInAsync(
        CookieAuthenticationDefaults.AuthenticationScheme,
        new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)));

    return Results.Ok(new { ok = true });
});

app.Run();

static string CreateCsrfToken()
{
    return System.Security.Cryptography.RandomNumberGenerator.GetHexString(48);
}

static void WriteCsrfCookie(HttpContext context, string token, bool isDevelopment)
{
    context.Response.Cookies.Append("Portfolio.Csrf", token, new CookieOptions
    {
        HttpOnly = false,
        SameSite = SameSiteMode.Strict,
        Secure = !isDevelopment,
        Path = "/"
    });
}

static bool ValidateCsrf(HttpContext context)
{
    var cookie = context.Request.Cookies["Portfolio.Csrf"];
    if (!context.Request.Headers.TryGetValue("X-CSRF-TOKEN", out var header))
    {
        return false;
    }

    return !string.IsNullOrWhiteSpace(cookie) &&
           string.Equals(cookie, header.ToString(), StringComparison.Ordinal);
}

static bool IsStrongPassword(string? password)
{
    if (string.IsNullOrWhiteSpace(password) || password.Length < 12)
    {
        return false;
    }

    return password.Any(char.IsLower) &&
           password.Any(char.IsUpper) &&
           password.Any(char.IsDigit) &&
           password.Any(ch => !char.IsLetterOrDigit(ch));
}
