import { z } from 'zod';
const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[4][0-9a-fA-F]{3}-[89AB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/i;
export const ProjectSchema = z.object({
    name: z.string(),
    id: z.string().refine((id) => uuidRegex.test(id), {
        message: 'Invalid UUID',
    }),
    type: z.string().optional(),
    description: z.string().optional(),
    created: z.date().or(z.string()),
    updated: z.date().or(z.string()),
    gitHubRepo: z.string().optional(),
    do_link: z.string().optional(),
    do_app_id: z.string().optional(),
    do_config: z.any().optional(),
});
export const RequiredEnvsSchema = z.object({
    GH_USERNAME: z.string().min(1),
    GH_TOKEN: z.string().min(1),
    DO_REGISTRY_NAME: z.string().min(1),
    DO_API_TOKEN: z.string().min(1),
    DO_SPACES_REGION: z.string().min(1),
    DO_SPACES_ACCESS_KEY: z.string().min(1),
    DO_SPACES_SECRET_KEY: z.string().min(1),
    AMZ_ID: z.string().min(1),
    AMZ_SEC: z.string().min(1),
    AMZ_REGION: z.string().min(1),
});
export const ServiceSchema = z.object({
    name: z.string(),
    id: z.string().refine((id) => uuidRegex.test(id), {
        message: 'Invalid UUID',
    }),
    internal_name: z.string(),
    config: z.record(z.any()),
    url: z.string(),
    updated: z.date().or(z.string()),
    created: z.date().or(z.string()),
    serviceType: z.string(),
    apiId: z.string(),
});
export const TemplateSchema = z.object({
    name: z.string(),
    id: z.string().refine((id) => uuidRegex.test(id), {
        message: 'Invalid UUID',
    }),
    description: z.string(),
    requiredKeys: z.array(z.string()),
    fileLocation: z.string(),
    internal_name: z.string(),
    deploy_file_location: z.string(),
});
export const ConfigSchema = z.object({
    projects: z.array(ProjectSchema),
    useEnvFile: z.boolean(),
    envPath: z.string(),
    services: z.array(ServiceSchema),
    templates: z.array(TemplateSchema),
});
