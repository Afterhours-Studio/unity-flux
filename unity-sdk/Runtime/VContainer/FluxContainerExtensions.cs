#if UNITY_FLUX_VCONTAINER
using VContainer;

namespace UnityFlux.Integration
{
    public static class FluxContainerExtensions
    {
        /// <summary>
        /// Register FluxManager as IFluxManager + IFluxDataAccess singleton.
        /// FluxManager.Configure(config) is called automatically.
        /// </summary>
        public static RegistrationBuilder RegisterFlux(
            this IContainerBuilder builder, FluxConfig config)
        {
            builder.RegisterBuildCallback(resolver =>
            {
                var manager = resolver.Resolve<IFluxManager>();
                manager.Configure(config);
            });

            return builder.Register<FluxManager>(Lifetime.Singleton)
                .As<IFluxManager>()
                .As<IFluxDataAccess>();
        }
    }
}
#endif
