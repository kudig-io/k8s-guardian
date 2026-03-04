const k8s = require('@kubernetes/client-node')

jest.mock('@kubernetes/client-node')

describe('Kubernetes Client', () => {
  let k8sModule

  beforeEach(() => {
    jest.clearAllMocks()
    k8sModule = require('../src/k8s')
  })

  describe('connectK8s', () => {
    it('should connect to Kubernetes cluster successfully', async () => {
      const mockKubeConfig = {
        loadFromDefault: jest.fn(),
        makeApiClient: jest.fn(() => ({}))
      }

      k8s.KubeConfig.mockImplementation(() => mockKubeConfig)

      const result = await k8sModule.connectK8s()

      expect(mockKubeConfig.loadFromDefault).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('should throw error when connection fails', async () => {
      k8s.KubeConfig.mockImplementation(() => {
        throw new Error('Connection failed')
      })

      await expect(k8sModule.connectK8s()).rejects.toThrow('Failed to connect to Kubernetes cluster')
    })
  })
})
