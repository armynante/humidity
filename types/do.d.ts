export interface DoAppSpec {
  name: string;
  region: string;
  features: string[];
  ingress: {
    rules: {
      component: {
        name: string;
      };
      match: {
        path: {
          prefix: string;
        };
      };
    }[];
  };
  services: {
    name: string;
    http_port: number;
    image: {
      registry_type: string;
      repository: string;
      tag: string;
      deploy_on_push: {
        enabled: boolean;
      };
    };
    instance_count: number;
    instance_size_slug: string;
  }[];
}
