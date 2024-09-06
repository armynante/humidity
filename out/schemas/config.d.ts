import { z } from 'zod';
export declare const ProjectSchema: z.ZodObject<{
    name: z.ZodString;
    id: z.ZodEffects<z.ZodString, `${string}-${string}-${string}-${string}-${string}`, string>;
    type: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    created: z.ZodUnion<[z.ZodDate, z.ZodString]>;
    updated: z.ZodUnion<[z.ZodDate, z.ZodString]>;
    gitHubRepo: z.ZodOptional<z.ZodString>;
    do_link: z.ZodOptional<z.ZodString>;
    do_app_id: z.ZodOptional<z.ZodString>;
    do_config: z.ZodOptional<z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    name: string;
    updated: string | Date;
    created: string | Date;
    id: `${string}-${string}-${string}-${string}-${string}`;
    type?: string | undefined;
    description?: string | undefined;
    gitHubRepo?: string | undefined;
    do_link?: string | undefined;
    do_app_id?: string | undefined;
    do_config?: any;
}, {
    name: string;
    updated: string | Date;
    created: string | Date;
    id: string;
    type?: string | undefined;
    description?: string | undefined;
    gitHubRepo?: string | undefined;
    do_link?: string | undefined;
    do_app_id?: string | undefined;
    do_config?: any;
}>;
export declare const RequiredEnvsSchema: z.ZodObject<{
    GH_USERNAME: z.ZodString;
    GH_TOKEN: z.ZodString;
    DO_REGISTRY_NAME: z.ZodString;
    DO_API_TOKEN: z.ZodString;
    DO_SPACES_REGION: z.ZodString;
    DO_SPACES_ACCESS_KEY: z.ZodString;
    DO_SPACES_SECRET_KEY: z.ZodString;
    AMZ_ID: z.ZodString;
    AMZ_SEC: z.ZodString;
    AMZ_REGION: z.ZodString;
}, "strip", z.ZodTypeAny, {
    GH_USERNAME: string;
    GH_TOKEN: string;
    DO_REGISTRY_NAME: string;
    DO_API_TOKEN: string;
    DO_SPACES_REGION: string;
    DO_SPACES_ACCESS_KEY: string;
    DO_SPACES_SECRET_KEY: string;
    AMZ_ID: string;
    AMZ_SEC: string;
    AMZ_REGION: string;
}, {
    GH_USERNAME: string;
    GH_TOKEN: string;
    DO_REGISTRY_NAME: string;
    DO_API_TOKEN: string;
    DO_SPACES_REGION: string;
    DO_SPACES_ACCESS_KEY: string;
    DO_SPACES_SECRET_KEY: string;
    AMZ_ID: string;
    AMZ_SEC: string;
    AMZ_REGION: string;
}>;
export declare const ServiceSchema: z.ZodObject<{
    name: z.ZodString;
    id: z.ZodEffects<z.ZodString, `${string}-${string}-${string}-${string}-${string}`, string>;
    internal_name: z.ZodString;
    config: z.ZodRecord<z.ZodString, z.ZodAny>;
    url: z.ZodString;
    updated: z.ZodUnion<[z.ZodDate, z.ZodString]>;
    created: z.ZodUnion<[z.ZodDate, z.ZodString]>;
    serviceType: z.ZodString;
    apiId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    url: string;
    name: string;
    updated: string | Date;
    created: string | Date;
    config: Record<string, any>;
    id: `${string}-${string}-${string}-${string}-${string}`;
    internal_name: string;
    serviceType: string;
    apiId: string;
}, {
    url: string;
    name: string;
    updated: string | Date;
    created: string | Date;
    config: Record<string, any>;
    id: string;
    internal_name: string;
    serviceType: string;
    apiId: string;
}>;
export declare const TemplateSchema: z.ZodObject<{
    name: z.ZodString;
    id: z.ZodEffects<z.ZodString, `${string}-${string}-${string}-${string}-${string}`, string>;
    description: z.ZodString;
    requiredKeys: z.ZodArray<z.ZodString, "many">;
    fileLocation: z.ZodString;
    internal_name: z.ZodString;
    deploy_file_location: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    id: `${string}-${string}-${string}-${string}-${string}`;
    internal_name: string;
    requiredKeys: string[];
    fileLocation: string;
    deploy_file_location: string;
}, {
    name: string;
    description: string;
    id: string;
    internal_name: string;
    requiredKeys: string[];
    fileLocation: string;
    deploy_file_location: string;
}>;
export declare const ConfigSchema: z.ZodObject<{
    projects: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        id: z.ZodEffects<z.ZodString, `${string}-${string}-${string}-${string}-${string}`, string>;
        type: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        created: z.ZodUnion<[z.ZodDate, z.ZodString]>;
        updated: z.ZodUnion<[z.ZodDate, z.ZodString]>;
        gitHubRepo: z.ZodOptional<z.ZodString>;
        do_link: z.ZodOptional<z.ZodString>;
        do_app_id: z.ZodOptional<z.ZodString>;
        do_config: z.ZodOptional<z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        updated: string | Date;
        created: string | Date;
        id: `${string}-${string}-${string}-${string}-${string}`;
        type?: string | undefined;
        description?: string | undefined;
        gitHubRepo?: string | undefined;
        do_link?: string | undefined;
        do_app_id?: string | undefined;
        do_config?: any;
    }, {
        name: string;
        updated: string | Date;
        created: string | Date;
        id: string;
        type?: string | undefined;
        description?: string | undefined;
        gitHubRepo?: string | undefined;
        do_link?: string | undefined;
        do_app_id?: string | undefined;
        do_config?: any;
    }>, "many">;
    useEnvFile: z.ZodBoolean;
    envPath: z.ZodString;
    services: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        id: z.ZodEffects<z.ZodString, `${string}-${string}-${string}-${string}-${string}`, string>;
        internal_name: z.ZodString;
        config: z.ZodRecord<z.ZodString, z.ZodAny>;
        url: z.ZodString;
        updated: z.ZodUnion<[z.ZodDate, z.ZodString]>;
        created: z.ZodUnion<[z.ZodDate, z.ZodString]>;
        serviceType: z.ZodString;
        apiId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        url: string;
        name: string;
        updated: string | Date;
        created: string | Date;
        config: Record<string, any>;
        id: `${string}-${string}-${string}-${string}-${string}`;
        internal_name: string;
        serviceType: string;
        apiId: string;
    }, {
        url: string;
        name: string;
        updated: string | Date;
        created: string | Date;
        config: Record<string, any>;
        id: string;
        internal_name: string;
        serviceType: string;
        apiId: string;
    }>, "many">;
    templates: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        id: z.ZodEffects<z.ZodString, `${string}-${string}-${string}-${string}-${string}`, string>;
        description: z.ZodString;
        requiredKeys: z.ZodArray<z.ZodString, "many">;
        fileLocation: z.ZodString;
        internal_name: z.ZodString;
        deploy_file_location: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        id: `${string}-${string}-${string}-${string}-${string}`;
        internal_name: string;
        requiredKeys: string[];
        fileLocation: string;
        deploy_file_location: string;
    }, {
        name: string;
        description: string;
        id: string;
        internal_name: string;
        requiredKeys: string[];
        fileLocation: string;
        deploy_file_location: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    templates: {
        name: string;
        description: string;
        id: `${string}-${string}-${string}-${string}-${string}`;
        internal_name: string;
        requiredKeys: string[];
        fileLocation: string;
        deploy_file_location: string;
    }[];
    projects: {
        name: string;
        updated: string | Date;
        created: string | Date;
        id: `${string}-${string}-${string}-${string}-${string}`;
        type?: string | undefined;
        description?: string | undefined;
        gitHubRepo?: string | undefined;
        do_link?: string | undefined;
        do_app_id?: string | undefined;
        do_config?: any;
    }[];
    useEnvFile: boolean;
    envPath: string;
    services: {
        url: string;
        name: string;
        updated: string | Date;
        created: string | Date;
        config: Record<string, any>;
        id: `${string}-${string}-${string}-${string}-${string}`;
        internal_name: string;
        serviceType: string;
        apiId: string;
    }[];
}, {
    templates: {
        name: string;
        description: string;
        id: string;
        internal_name: string;
        requiredKeys: string[];
        fileLocation: string;
        deploy_file_location: string;
    }[];
    projects: {
        name: string;
        updated: string | Date;
        created: string | Date;
        id: string;
        type?: string | undefined;
        description?: string | undefined;
        gitHubRepo?: string | undefined;
        do_link?: string | undefined;
        do_app_id?: string | undefined;
        do_config?: any;
    }[];
    useEnvFile: boolean;
    envPath: string;
    services: {
        url: string;
        name: string;
        updated: string | Date;
        created: string | Date;
        config: Record<string, any>;
        id: string;
        internal_name: string;
        serviceType: string;
        apiId: string;
    }[];
}>;
export type Project = z.infer<typeof ProjectSchema>;
export type RequiredEnvs = z.infer<typeof RequiredEnvsSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type Config = z.infer<typeof ConfigSchema>;
export type NewProjectQuestions = {
    name: string;
    projectType?: string;
    description?: string;
};
