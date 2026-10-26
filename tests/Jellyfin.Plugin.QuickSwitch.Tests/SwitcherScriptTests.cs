using System.IO;
using Jellyfin.Plugin.QuickSwitch.Controllers;
using Microsoft.AspNetCore.Http;
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
        var (controller, _) = Controller();

        var result = Assert.IsType<FileStreamResult>(controller.GetScript());
        result.FileStream.Dispose();

        Assert.StartsWith("text/javascript", result.ContentType);
    }

    [Fact]
    public void ClientsMustRevalidateTheScriptOnEveryLoad()
    {
        var (controller, context) = Controller();

        Assert.IsType<FileStreamResult>(controller.GetScript()).FileStream.Dispose();

        Assert.Equal("no-cache", context.Response.Headers.CacheControl.ToString());
        Assert.Equal(new SwitcherScript().ETag, context.Response.Headers.ETag.ToString());
    }

    [Fact]
    public void TheETagFollowsTheScriptContent()
    {
        var etag = new SwitcherScript().ETag;

        Assert.Matches("^\"[0-9a-f]{16}\"$", etag);
        Assert.Equal(etag, new SwitcherScript().ETag);
    }

    [Fact]
    public void AMatchingIfNoneMatchGetsNotModified()
    {
        var (controller, context) = Controller();
        context.Request.Headers.IfNoneMatch = new SwitcherScript().ETag;

        var result = Assert.IsType<StatusCodeResult>(controller.GetScript());

        Assert.Equal(StatusCodes.Status304NotModified, result.StatusCode);
        Assert.Equal(new SwitcherScript().ETag, context.Response.Headers.ETag.ToString());
    }

    [Fact]
    public void AStaleIfNoneMatchGetsTheScript()
    {
        var (controller, context) = Controller();
        context.Request.Headers.IfNoneMatch = "\"0000000000000000\"";

        Assert.IsType<FileStreamResult>(controller.GetScript()).FileStream.Dispose();
    }

    private static (SwitcherScriptController Controller, DefaultHttpContext Context) Controller()
    {
        var context = new DefaultHttpContext();
        var controller = new SwitcherScriptController(new SwitcherScript())
        {
            ControllerContext = new ControllerContext { HttpContext = context },
        };
        return (controller, context);
    }
}
