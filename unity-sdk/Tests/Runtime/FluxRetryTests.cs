using System;
using System.Threading.Tasks;
using NUnit.Framework;
using UnityFlux.Internal;

namespace UnityFlux.Tests
{
    [TestFixture]
    public class FluxRetryTests
    {
        [Test]
        public async Task ExecuteAsync_SucceedsFirstAttempt_ReturnsResult()
        {
            var result = await FluxRetry.ExecuteAsync(async () =>
            {
                await Task.CompletedTask;
                return 42;
            }, maxRetries: 3, baseDelaySec: 0.01f);

            Assert.AreEqual(42, result);
        }

        [Test]
        public async Task ExecuteAsync_FailsThenSucceeds_ReturnsResult()
        {
            int attempts = 0;
            var result = await FluxRetry.ExecuteAsync(async () =>
            {
                await Task.CompletedTask;
                attempts++;
                if (attempts < 3) throw new Exception("Transient error");
                return "success";
            }, maxRetries: 3, baseDelaySec: 0.01f);

            Assert.AreEqual("success", result);
            Assert.AreEqual(3, attempts);
        }

        [Test]
        public void ExecuteAsync_AllAttemptsFail_ThrowsException()
        {
            Assert.ThrowsAsync<Exception>(async () =>
            {
                await FluxRetry.ExecuteAsync<int>(async () =>
                {
                    await Task.CompletedTask;
                    throw new Exception("Always fails");
                }, maxRetries: 2, baseDelaySec: 0.01f);
            });
        }

        [Test]
        public async Task ExecuteAsync_AllAttemptsFail_WrapsInnerException()
        {
            Exception caught = null;
            try
            {
                await FluxRetry.ExecuteAsync<int>(async () =>
                {
                    await Task.CompletedTask;
                    throw new InvalidOperationException("inner error");
                }, maxRetries: 1, baseDelaySec: 0.01f);
            }
            catch (Exception ex)
            {
                caught = ex;
            }

            Assert.IsNotNull(caught);
            Assert.IsTrue(caught.Message.Contains("2 attempts failed"));
            Assert.IsInstanceOf<InvalidOperationException>(caught.InnerException);
        }

        [Test]
        public async Task ExecuteAsync_ZeroRetries_OnlyTriesOnce()
        {
            int attempts = 0;
            try
            {
                await FluxRetry.ExecuteAsync(async () =>
                {
                    await Task.CompletedTask;
                    attempts++;
                    throw new Exception("fail");
#pragma warning disable CS0162
                    return 0;
#pragma warning restore CS0162
                }, maxRetries: 0, baseDelaySec: 0.01f);
            }
            catch { }

            Assert.AreEqual(1, attempts);
        }

        [Test]
        public async Task ExecuteAsync_RetriesCorrectNumberOfTimes()
        {
            int attempts = 0;
            try
            {
                await FluxRetry.ExecuteAsync(async () =>
                {
                    await Task.CompletedTask;
                    attempts++;
                    throw new Exception("fail");
#pragma warning disable CS0162
                    return 0;
#pragma warning restore CS0162
                }, maxRetries: 3, baseDelaySec: 0.01f);
            }
            catch { }

            // 1 initial attempt + 3 retries = 4 total
            Assert.AreEqual(4, attempts);
        }

        [Test]
        public async Task ExecuteAsync_SucceedsOnLastRetry_ReturnsResult()
        {
            int attempts = 0;
            var result = await FluxRetry.ExecuteAsync(async () =>
            {
                await Task.CompletedTask;
                attempts++;
                if (attempts <= 3) throw new Exception("not yet");
                return "finally";
            }, maxRetries: 3, baseDelaySec: 0.01f);

            Assert.AreEqual("finally", result);
            Assert.AreEqual(4, attempts);
        }
    }
}
