using System;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Security.Cryptography;

namespace Jellyfin.Plugin.QuickSwitch;

/// <summary>
/// The switcher script and its stylesheet, embedded in the plugin assembly.
/// </summary>
[SuppressMessage("Performance", "CA1822:Mark members as static", Justification = "A service the controller is given; its members stay instance members so it can be injected.")]
public class SwitcherScript
{
    /// <summary>
    /// The script's file name, under the plugin route.
    /// </summary>
    public const string FileName = "quick-switch.js";

    /// <summary>
    /// The script's content type.
    /// </summary>
    public const string ContentType = "text/javascript; charset=utf-8";

    /// <summary>
    /// The stylesheet's file name, under the plugin route, beside the script.
    /// </summary>
    public const string StyleFileName = "quick-switch.css";

    /// <summary>
    /// The stylesheet's content type.
    /// </summary>
    public const string StyleContentType = "text/css; charset=utf-8";

    private static readonly Lazy<string> _etag = new(() => ComputeETag(FileName));

    private static readonly Lazy<string> _styleETag = new(() => ComputeETag(StyleFileName));

    /// <summary>
    /// Gets the plugin version, which the script tag carries so an upgrade changes the script's URL.
    /// </summary>
    public static string Version { get; } = typeof(SwitcherScript).Assembly.GetName().Version?.ToString() ?? "0";

    /// <summary>
    /// Gets the entity tag of the embedded script: a quoted prefix of its SHA-256.
    /// </summary>
    public string ETag => _etag.Value;

    /// <summary>
    /// Gets the entity tag of the embedded stylesheet, made the same way.
    /// </summary>
    public string StyleETag => _styleETag.Value;

    /// <summary>
    /// Opens the script.
    /// </summary>
    /// <returns>The script content.</returns>
    public Stream Open() => OpenResource(FileName);

    /// <summary>
    /// Opens the stylesheet.
    /// </summary>
    /// <returns>The stylesheet content.</returns>
    public Stream OpenStyle() => OpenResource(StyleFileName);

    private static Stream OpenResource(string name) =>
        typeof(SwitcherScript).Assembly.GetManifestResourceStream(name)
        ?? throw new FileNotFoundException($"{name} is not embedded in the plugin assembly.", name);

    private static string ComputeETag(string name)
    {
        using var stream = OpenResource(name);
        var hash = Convert.ToHexStringLower(SHA256.HashData(stream));
        return "\"" + hash[..16] + "\"";
    }
}
