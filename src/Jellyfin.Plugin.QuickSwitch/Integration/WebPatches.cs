using System;

namespace Jellyfin.Plugin.QuickSwitch.Integration;

/// <summary>
/// The one change made to jellyfin-web as it is served: a script tag for the switcher in index.html.
/// </summary>
public static class WebPatches
{
    // Relative to {base}/web/, so it resolves under any configured BaseUrl.
    private const string ScriptSource = "../QuickSwitch/" + SwitcherScript.FileName;

    // The version changes the script's URL on every upgrade, so no client keeps running an old copy.
    private static readonly string _scriptTag = "<script src=\"" + ScriptSource + "?v=" + SwitcherScript.Version + "\"></script>";

    /// <summary>
    /// Adds the switcher to index.html as a classic script, which runs before
    /// jellyfin-web's deferred bundles.
    /// </summary>
    /// <param name="html">The served index.html.</param>
    /// <returns>The patched page, or null to leave it unchanged.</returns>
    public static string? PatchIndex(string html)
    {
        if (html.Contains("<script src=\"" + ScriptSource, StringComparison.Ordinal))
        {
            return null;
        }

        var head = html.IndexOf("</head>", StringComparison.OrdinalIgnoreCase);
        return head < 0 ? null : html.Insert(head, _scriptTag);
    }
}
