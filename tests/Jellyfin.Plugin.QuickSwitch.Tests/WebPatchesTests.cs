using Jellyfin.Plugin.QuickSwitch.Integration;
using Xunit;

namespace Jellyfin.Plugin.QuickSwitch.Tests;

public class WebPatchesTests
{
    private const string Index = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><script defer=\"defer\" src=\"main.jellyfin.bundle.js\"></script></head><body></body></html>";

    private const string Tag = "<script src=\"../QuickSwitch/quick-switch.js\"></script>";

    [Fact]
    public void IndexGetsOneClassicScriptTagInTheHead()
    {
        var patched = WebPatches.PatchIndex(Index);

        Assert.NotNull(patched);
        Assert.Contains(Tag + "</head>", patched);
        Assert.Equal(Index, patched.Replace(Tag, string.Empty));
    }

    [Fact]
    public void IndexIsLeftAloneWhenAlreadyPatchedOrWithoutAHead()
    {
        Assert.Null(WebPatches.PatchIndex(WebPatches.PatchIndex(Index)!));
        Assert.Null(WebPatches.PatchIndex("<html><body></body></html>"));
    }
}
