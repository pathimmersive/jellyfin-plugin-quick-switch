using System.IO;
using Jellyfin.Plugin.QuickSwitch.Controllers;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace Jellyfin.Plugin.QuickSwitch.Tests;

public class SwitcherScriptTests
{
    [Fact]
    public void TheScriptIsEmbedded()
    {
        using var reader = new StreamReader(new SwitcherScript().Open());

        Assert.Contains("window.QuickSwitch", reader.ReadToEnd());
    }

    [Fact]
    public void TheControllerServesItAsJavaScript()
    {
        var result = Assert.IsType<FileStreamResult>(new SwitcherScriptController(new SwitcherScript()).GetScript());
        result.FileStream.Dispose();

        Assert.StartsWith("text/javascript", result.ContentType);
    }
}
