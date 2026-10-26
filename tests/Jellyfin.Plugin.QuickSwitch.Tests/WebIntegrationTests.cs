using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Jellyfin.Plugin.FileTransformation;
using Jellyfin.Plugin.QuickSwitch.Integration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Jellyfin.Plugin.QuickSwitch.Tests;

[Collection(nameof(FakeFileTransformation))]
public class WebIntegrationTests : IDisposable
{
    public WebIntegrationTests() => PluginInterface.Reset();

    public void Dispose() => PluginInterface.Reset();

    private static FileTransformationBridge Installed() => new(() => [typeof(PluginInterface).Assembly]);

    private static FileTransformationBridge Missing() => new(() => [typeof(object).Assembly]);

    private static WebIntegrationService Service(FileTransformationBridge bridge) => new(bridge, NullLogger<WebIntegrationService>.Instance);

    [Fact]
    public async Task WithoutFileTransformationNothingIsRegistered()
    {
        Assert.False(Missing().IsAvailable);

        await Service(Missing()).StartAsync(CancellationToken.None);

        Assert.Empty(PluginInterface.Registered);
    }

    [Fact]
    public async Task StartingRegistersTheIndexPatch()
    {
        await Service(Installed()).StartAsync(CancellationToken.None);

        var payload = Assert.Single(PluginInterface.Registered.Values);
        Assert.Equal("^index\\.html$", payload["fileNamePattern"]);
        Assert.Equal(nameof(TransformCallbacks.Index), payload["callbackMethod"]);
        Assert.Equal(typeof(TransformCallbacks).FullName, payload["callbackClass"]);
        Assert.Equal(typeof(TransformCallbacks).Assembly.FullName, payload["callbackAssembly"]);
    }

    [Fact]
    public async Task StoppingRemovesTheRegistration()
    {
        var service = Service(Installed());
        await service.StartAsync(CancellationToken.None);

        await service.StopAsync(CancellationToken.None);

        Assert.Empty(PluginInterface.Registered);
        Assert.Equal(WebIntegrationService.IndexTransformationId, PluginInterface.Removed.Single());
    }

    [Fact]
    public async Task ARegistrationFailureLeavesTheServerRunning()
    {
        PluginInterface.Fail = true;

        await Service(Installed()).StartAsync(CancellationToken.None);

        Assert.Empty(PluginInterface.Registered);
    }

    [Fact]
    public void TheCallbackMatchesWhatFileTransformationInvokes()
    {
        // File Transformation calls a public static method with one parameter and takes a string back.
        var method = typeof(TransformCallbacks).GetMethod(nameof(TransformCallbacks.Index))!;

        Assert.True(method.IsStatic && method.IsPublic);
        Assert.Equal(typeof(string), method.ReturnType);
        Assert.Equal(typeof(TransformInput), Assert.Single(method.GetParameters()).ParameterType);
    }
}

[CollectionDefinition(nameof(FakeFileTransformation), DisableParallelization = true)]
public class FakeFileTransformation;
