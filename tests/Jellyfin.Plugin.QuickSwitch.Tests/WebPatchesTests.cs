using Jellyfin.Plugin.QuickSwitch.Integration;
using Xunit;

namespace Jellyfin.Plugin.QuickSwitch.Tests;

public class WebPatchesTests
{
    private const string Index = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><script defer=\"defer\" src=\"main.jellyfin.bundle.js\"></script></head><body></body></html>";

    private static readonly string Tag = "<script src=\"../QuickSwitch/quick-switch.js?v=" + typeof(Plugin).Assembly.GetName().Version + "\"></script>";

    [Fact]
    public void IndexGetsOneClassicScriptTagInTheHead()
    {
        var patched = WebPatches.PatchIndex(Index);

        Assert.NotNull(patched);
        Assert.Contains(Tag + "</head>", patched);
        Assert.Equal(Index, patched.Replace(Tag, string.Empty));
    }

    [Fact]
    public void TheTagCarriesThePluginVersionSoAnUpgradeChangesItsUrl()
    {
        Assert.Contains("quick-switch.js?v=0.1.0.0\"", WebPatches.PatchIndex(Index));
    }

    [Fact]
    public void IndexIsLeftAloneWhenAlreadyPatchedOrWithoutAHead()
    {
        Assert.Null(WebPatches.PatchIndex(WebPatches.PatchIndex(Index)!));
        Assert.Null(WebPatches.PatchIndex(Index.Replace("</head>", "<script src=\"../QuickSwitch/quick-switch.js?v=0.0.9.0\"></script></head>")));
        Assert.Null(WebPatches.PatchIndex("<html><body></body></html>"));
    }
}
