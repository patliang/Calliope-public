import type { AgentComposerPayload } from '$lib/agentComposer';
import { t } from '$lib/i18n.svelte';

const API_BASE = '';

export interface Project {
	id: number;
	title: string;
	/** Full source text. Present only on the single-project response. */
	idea: string | null;
	/**
	 * First 200 characters of the source text. The list endpoint sends this
	 * instead of `idea` so the project list does not download every novel on
	 * every page load. For a logline project it equals `idea`.
	 */
	idea_preview: string | null;
	genre: string | null;
	tone: string | null;
	target_duration: string | null;
	cover_path: string | null;
	status: string;
	/**
	 * `builtin` = the in-app generators own this project's content.
	 * `external` = authored outside Calliope via calliope-cli, so the web UI
	 * hides the buttons that would overwrite it.
	 */
	ingest_mode: string;
	/** Length of the stored novel (`source_text`), when one was condensed into `idea`. */
	source_chars?: number | null;
	format?: ProjectFormat;
	/** The project's look (Settings > Styles); null = the format's built-in look. */
	render_style_id?: number | null;
	/** Part-by-part outline of the stored novel; Draft Storyline reads it. */
	source_summaries?: string[];
	/** Longest Story idea the built-in generators take (story endpoint only). */
	idea_limit?: number;
	created_at: string;
	updated_at: string;
	stats?: ProjectStats;
}

export interface ProjectStats {
	scene_count: number;
	character_count: number;
	asset_ready_count: number;
	asset_total_count: number;
}

export type ProjectFormat = 'video' | 'webtoon' | 'manga';

export interface ProjectCreate {
	title: string;
	idea?: string;
	genre?: string;
	tone?: string;
	target_duration?: string;
	/** Fixed at creation: a film, a webtoon strip or manga pages. */
	format?: ProjectFormat;
}

export interface Bubble {
	speaker: string;
	text: string;
	/** Position as 0..1 of the panel; null = automatic. */
	x: number | null;
	y: number | null;
}

export interface Panel {
	id: number;
	clip_id: number;
	prompt: string;
	seed: number;
	width: number;
	height: number;
	refs: string[];
	bubbles: Bubble[];
	caption: string | null;
	image_path: string | null;
	job_id: number | null;
	job_status: string | null;
	job_error: string | null;
	shot_size: string | null;
	scene_order: number;
	clip_order: number;
}

export interface MangaPage {
	/** Panel ids in reading order. */
	panels: number[];
	template: string;
	/** Template chosen automatically (re-chosen when the page's panels change). */
	auto: boolean;
}

export interface MangaLayout {
	pages: MangaPage[];
	/** The user changed pages; false = fully automatic. */
	custom: boolean;
	/** Layout names per panel count on a page. */
	templates: Record<number, string[]>;
	max_per_page: number;
}

export interface ActivityOp {
	id: number;
	kind: string;
	label: string;
	step: string | null;
	elapsed_sec: number;
}

export interface ProjectActivity {
	busy: boolean;
	operations: ActivityOp[];
	agents: { session_id: number; title: string }[];
	jobs: { running: number; queued: number; current_kind: string | null };
}

export const activityApi = {
	project: (projectId: number) => api<ProjectActivity>(`/api/activity?project_id=${projectId}`),
	all: () => api<{ projects: Record<string, ProjectActivity> }>('/api/activity'),
};

export const comicApi = {
	list: (projectId: number) => api<Panel[]>(`/api/projects/${projectId}/panels`),
	plan: (projectId: number, replan = false) =>
		api<Panel[]>(`/api/projects/${projectId}/panels/plan`, { method: 'POST', body: JSON.stringify({ replan }) }),
	render: (projectId: number, payload: { panel_ids?: number[]; missing_only?: boolean; reseed?: boolean } = {}) =>
		api<{ queued: number; job_ids: number[] }>(`/api/projects/${projectId}/panels/render`, {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
	update: (panelId: number, payload: { prompt?: string; seed?: number; caption?: string; bubbles?: Bubble[] }) =>
		api<Panel>(`/api/panels/${panelId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
	export: (projectId: number, rtl = true) =>
		api<{ files: string[] }>(`/api/projects/${projectId}/comic/export`, {
			method: 'POST',
			body: JSON.stringify({ rtl }),
		}),
	layout: (projectId: number) => api<MangaLayout>(`/api/projects/${projectId}/comic/layout`),
	saveLayout: (projectId: number, pages: MangaPage[]) =>
		api<MangaLayout>(`/api/projects/${projectId}/comic/layout`, { method: 'PUT', body: JSON.stringify({ pages }) }),
	resetLayout: (projectId: number) =>
		api<MangaLayout>(`/api/projects/${projectId}/comic/layout`, { method: 'DELETE' }),
};

export interface Beat {
	id: number;
	order_index: number;
	title: string;
	description: string | null;
}

export interface Character {
	id: number;
	name: string;
	role: string | null;
	age: string | null;
	appearance: string | null;
	personality: string | null;
	portrait_path: string | null;
	sheet_path: string | null;
	consistency_prompt: string | null;
	/** "key:value" or plain labels, e.g. "alias:Ripper Eddy". */
	tags: string[];
	/** The user's own pictures the asset was made from. */
	source_images?: string[];
}

export interface Location {
	id: number;
	name: string;
	description: string | null;
	reference_image_path: string | null;
	consistency_prompt: string | null;
	tags: string[];
	/** The user's own pictures the asset was made from. */
	source_images?: string[];
}

export interface Item {
	id: number;
	name: string;
	description: string | null;
	reference_image_path: string | null;
	consistency_prompt: string | null;
	tags: string[];
	/** weapon, vehicle, device, … (free text). */
	category: string | null;
	/** The user's own pictures the asset was made from. */
	source_images?: string[];
}

export type AssetKind = 'character' | 'location' | 'item';

/** A character/location/item kept across projects (a copy with its images). */
export interface LibraryAsset {
	id: number;
	kind: AssetKind;
	name: string;
	category: string | null;
	tags: string[];
	/** Fields of the asset (appearance/description, …), source_images and a pending_job while rendering. */
	data: Record<string, unknown>;
	image_path: string | null;
	source_project_id: number | null;
	created_at: string;
	/** Project the asset was saved from, and projects holding a copy. */
	source_project?: { id: number; title: string } | null;
	used_in?: { id: number; title: string; outdated?: boolean }[];
}

export const colorizeApi = {
	start: (payload: { image_path: string; notes: string; project_id?: number | null; character_ids?: number[] | null }) =>
		api<{ job_id: number }>('/api/colorize', { method: 'POST', body: JSON.stringify(payload) }),
};

export const assetLibraryApi = {
	list: (params: { kind?: AssetKind; q?: string; tag?: string } = {}) => {
		const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
		return api<LibraryAsset[]>(`/api/asset-library${qs.size ? `?${qs}` : ''}`);
	},
	save: (projectId: number, kind: AssetKind, entityId: number) =>
		api<LibraryAsset>(`/api/projects/${projectId}/${kind}/${entityId}/to-library`, { method: 'POST' }),
	addToProject: (assetId: number, projectId: number) =>
		api<Record<string, unknown>>(`/api/asset-library/${assetId}/to-project`, {
			method: 'POST',
			body: JSON.stringify({ project_id: projectId }),
		}),
	update: (
		assetId: number,
		payload: {
			name?: string;
			category?: string | null;
			tags?: string[];
			data?: Record<string, unknown>;
			source_images?: string[];
		},
	) =>
		api<LibraryAsset>(`/api/asset-library/${assetId}`, { method: 'PATCH', body: JSON.stringify(payload) }),
	remove: (assetId: number) => api<{ ok: boolean }>(`/api/asset-library/${assetId}`, { method: 'DELETE' }),
	create: (
		projectId: number,
		payload: { kind: AssetKind; name: string; prompt: string; image_paths: string[]; generate: boolean },
	) =>
		api<{ asset: Record<string, unknown>; job_id: number | null }>(`/api/projects/${projectId}/assets/new`, {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
	createInLibrary: (payload: { kind: AssetKind; name: string; prompt: string; image_paths: string[]; generate: boolean }) =>
		api<{ asset_id: number; job_id: number | null }>('/api/asset-library/new', {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
	describeLibrary: (assetId: number, keep: { notes?: string; alias?: string; role?: string } = {}) =>
		api<{
			field: string;
			text: string;
			tags: string[];
			category: string | null;
			/** The alias/role kept in the new sheet (filled fields win, empty ones take the suggestion). */
			alias: string | null;
			role: string | null;
		}>(`/api/asset-library/${assetId}/describe`, { method: 'POST', body: JSON.stringify(keep) }),
	describeProject: (projectId: number, kind: AssetKind, entityId: number) =>
		api<Record<string, unknown>>(`/api/projects/${projectId}/${kind}/${entityId}/describe`, { method: 'POST' }),
	matches: (projectId: number) =>
		api<
			{
				character_id: number;
				character_name: string;
				matches: {
					asset_id: number;
					name: string;
					score: number;
					why: string[];
					image_path: string | null;
					linked: boolean;
					/** The library identity changed since this character took it. */
					outdated: boolean;
				}[];
			}[]
		>(`/api/projects/${projectId}/library-matches`),
	applyIdentity: (assetId: number, projectId: number, characterId: number, replacePrompt = false) =>
		api<{ character: Character; prompt_kept: boolean }>(`/api/asset-library/${assetId}/apply/${projectId}/${characterId}`, {
			method: 'POST',
			body: JSON.stringify({ replace_prompt: replacePrompt }),
		}),
	updateFromLibrary: (projectId: number, characterId: number, replacePrompt = false) =>
		api<{ character: Character; prompt_kept: boolean }>(
			`/api/projects/${projectId}/character/${characterId}/update-from-library`,
			{ method: 'POST', body: JSON.stringify({ replace_prompt: replacePrompt }) },
		),
	/** Danbooru tags from the reference pictures (WD tagger; not saved): identity tags and the rest. */
	tagsFromPictures: (assetId: number) =>
		api<{ tags: string[]; outfit: string[]; pictures: number }>(`/api/asset-library/${assetId}/tags-from-pictures`, {
			method: 'POST',
		}),
	/** Draft the image prompt from what the reference pictures show (vision model; not saved). */
	promptFromPictures: (assetId: number) =>
		api<{ prompt: string; refs: string[]; pictures: string[]; style: string }>(
			`/api/asset-library/${assetId}/prompt-from-pictures`,
			{ method: 'POST' },
		),
	/** Exactly what a render sends: prompt, reference pictures, and whether Calliope wrote the prompt. */
	renderPreview: (assetId: number) =>
		api<{ prompt: string; refs: string[]; auto: boolean }>(`/api/asset-library/${assetId}/render-preview`),
	libraryFromImages: (assetId: number) =>
		api<{ job_id: number }>(`/api/asset-library/${assetId}/from-images`, { method: 'POST' }),
	fromImages: (projectId: number, kind: AssetKind, entityId: number) =>
		api<{ job_id: number }>(`/api/projects/${projectId}/${kind}/${entityId}/from-images`, { method: 'POST' }),
	suggestTags: (projectId: number) =>
		api<Record<string, number>>(`/api/projects/${projectId}/assets/suggest-tags`, { method: 'POST' }),
};

export interface StoryData {
	project: Project;
	beats: Beat[];
	characters: Character[];
	locations: Location[];
	items: Item[];
}

/**
 * Per-call thinking mode. `default` sends nothing and leaves the server's own
 * default alone — note llama.cpp templates commonly default to `xhigh`, which
 * makes even a one-sentence formatting rewrite burn thousands of reasoning
 * tokens. Which *level strings* a model accepts is decided by its own chat
 * template, not by us: Qwen3.x templates take low|medium|xhigh and raise on
 * anything else.
 */
export type ThinkingMode = 'default' | 'off' | 'low' | 'medium' | 'high' | 'xhigh';

export interface LlmProfile {
	id: string;
	name: string;
	base_url: string;
	model: string;
	api_key: boolean;
	thinking: ThinkingMode;
	/**
	 * Context window of the served model, cached from the probe's /models
	 * metadata. 0 = never probed, or the server reports none — the backend then
	 * uses its own fallback rather than assuming a generous window.
	 */
	context_tokens: number;
}

/** One row from GET {base_url}/models, normalized across server flavours. */
export interface LlmModelInfo {
	id: string;
	/** Accepts image_url content parts (llama.cpp reports this per model). */
	vision: boolean;
	modalities: string[];
	/** --ctx-size, when the server reports it. */
	ctx: number | null;
	/** Server-side default effort, e.g. `xhigh`. Null = unknown or disabled. */
	reasoning_effort: string | null;
	reasoning_disabled: boolean;
	/** Speculative decoding backend, e.g. `draft-mtp`. */
	speculative: string | null;
	/** llama.cpp load state: `unloaded` | `loading` | `loaded`. */
	loaded: string | null;
}

export interface LlmServerInfo {
	role?: string;
	build_info?: string;
	max_instances?: number;
	models_autoload?: boolean;
	model_alias?: string;
}

export interface LlmModelsResponse {
	ok: boolean;
	models: LlmModelInfo[];
	models_url: string | null;
	server: LlmServerInfo | null;
	error: string | null;
}

export interface LlmTestResponse extends LlmModelsResponse {
	/** The model list was fetched at all — false means the endpoint is down. */
	reachable: boolean;
	model: string;
	/** null = the server does not implement model listing. */
	model_found: boolean | null;
	available_models: string[];
	thinking: ThinkingMode;
	thinking_sent: Record<string, unknown>;
	chat_ok: boolean;
	latency_ms: number | null;
	first_token_ms: number | null;
	content: string | null;
	reasoning_chars: number;
	reasoning_preview: string | null;
	usage: Record<string, unknown> | null;
}

export interface Settings {
	/** Longest Story idea the built-in generators take (from the context window). */
	long_idea_chars?: number;
	host: string;
	port: number;
	data_dir: string;
	assets_dir: string;
	agent_workspace_dir: string;
	db_name: string;
	llm_base_url: string;
	llm_model: string;
	llm_api_key: boolean;
	llm_profiles: LlmProfile[];
	llm_active_id: string | null;
	comfyui_base_url: string;
	comfy_api_base_url: string;
	/** True when a Comfy API key is saved. The key itself is never sent to the browser. */
	comfy_api_key: boolean;
	/** Master switch for the Comfy API provider (Router choices in Project / Agent). */
	comfy_router_enabled: boolean;
	queue_concurrency: number;
	queue_poll_interval_sec: number;
	queue_poll_timeout_sec: number;
	queue_max_retries: number;
	agent_max_steps: number;
	agent_hardening_prompt: string;
	agent_history_char_budget: number;
	/** Fraction of the context window the trimmed history may occupy. */
	agent_history_token_share: number;
	/** Server-computed char ceiling actually in force (override or derived). */
	agent_history_char_budget_effective: number;
	/** Context window of the serving model, from the probe or the fallback. */
	context_window_tokens: number;
	llm_context_tokens: number;
	llm_context_fallback_tokens: number;
	llm_chars_per_token: number;
	llm_max_output_tokens: number;
	agent_llm_assignments: Record<string, string | null>;
	/** Workflow per job (Settings > Workflows roles); missing = Auto. */
	workflow_assignments?: Record<string, number | null>;
	agent_shell_enabled: boolean;
	/** Attach reference images/frames to the H3 prompt rewrite (slow on local vision models). */
	h3_rewrite_vision: boolean;
	dry_run: boolean;
}

import type {
	Job,
	Scene,
	SceneVideoSettings,
	Clip,
	Workflow,
	ComfyDynamicInput,
	ComfyDynamicOutput,
} from './comfy/types';
export type { Job, Scene, SceneVideoSettings, Clip, Workflow, ComfyDynamicInput, ComfyDynamicOutput };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`, {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...init?.headers,
		},
	});
	if (!res.ok) {
		const body = await res.text().catch(() => t('api.unknownError'));
		throw new Error(`${res.status}: ${body}`);
	}
	return res.json() as Promise<T>;
}

/** Multipart variant of api() — FormData sets its own Content-Type boundary. */
async function apiUpload<T>(path: string, form: FormData): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`, { method: 'POST', body: form });
	if (!res.ok) {
		const body = await res.text().catch(() => t('api.unknownError'));
		throw new Error(`${res.status}: ${body}`);
	}
	return res.json() as Promise<T>;
}

export function assetUrl(path: string | null | undefined): string | null {
	if (!path) return null;
	return `/api/file?path=${encodeURIComponent(path)}`;
}

export const projects = {
	list: () => api<Project[]>('/api/projects'),
	create: (payload: ProjectCreate) =>
		api<Project>('/api/projects', { method: 'POST', body: JSON.stringify(payload) }),
	get: (id: number) => api<Project & { stats: ProjectStats }>(`/api/projects/${id}`),
	update: (
		id: number,
		payload: Partial<
			ProjectCreate & { status?: string; cover_path?: string | null; source_summaries?: string[]; render_style_id?: number | null }
		>,
	) =>
		api<Project>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
	delete: (id: number) => api<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),
	getStory: (id: number) => api<StoryData>(`/api/projects/${id}/story`),
	/** Store a novel and replace Story idea with a model-written summary (< 2,000 chars). */
	condenseIdea: (id: number, payload: { text?: string; fill_fields?: boolean } = {}) =>
		api<Project>(`/api/projects/${id}/condense-idea`, { method: 'POST', body: JSON.stringify(payload) }),
	createCharacter: (
		projectId: number,
		payload: {
			name: string;
			role?: string;
			age?: string;
			appearance?: string;
			personality?: string;
			consistency_prompt?: string;
		},
	) =>
		api<Character>(`/api/projects/${projectId}/characters`, {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
	createLocation: (projectId: number, payload: { name: string; description?: string }) =>
		api<Location>(`/api/projects/${projectId}/locations`, {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
	createItem: (projectId: number, payload: { name: string; description?: string }) =>
		api<Item>(`/api/projects/${projectId}/items`, {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
	updateBeat: (projectId: number, beatId: number, payload: Partial<Beat>) =>
		api<Beat>(`/api/projects/${projectId}/beats/${beatId}`, {
			method: 'PATCH',
			body: JSON.stringify(payload),
		}),
	updateCharacter: (projectId: number, characterId: number, payload: Partial<Character>) =>
		api<Character>(`/api/projects/${projectId}/characters/${characterId}`, {
			method: 'PATCH',
			body: JSON.stringify(payload),
		}),
	updateLocation: (projectId: number, locationId: number, payload: Partial<Location>) =>
		api<Location>(`/api/projects/${projectId}/locations/${locationId}`, {
			method: 'PATCH',
			body: JSON.stringify(payload),
		}),
	updateItem: (projectId: number, itemId: number, payload: Partial<Item>) =>
		api<Item>(`/api/projects/${projectId}/items/${itemId}`, {
			method: 'PATCH',
			body: JSON.stringify(payload),
		}),
	deleteBeat: (projectId: number, beatId: number) =>
		api<{ ok: boolean }>(`/api/projects/${projectId}/beats/${beatId}`, { method: 'DELETE' }),
	deleteCharacter: (projectId: number, characterId: number) =>
		api<{ ok: boolean }>(`/api/projects/${projectId}/characters/${characterId}`, {
			method: 'DELETE',
		}),
	deleteLocation: (projectId: number, locationId: number) =>
		api<{ ok: boolean }>(`/api/projects/${projectId}/locations/${locationId}`, {
			method: 'DELETE',
		}),
	deleteItem: (projectId: number, itemId: number) =>
		api<{ ok: boolean }>(`/api/projects/${projectId}/items/${itemId}`, {
			method: 'DELETE',
		}),
	getScenes: (id: number) =>
		api<{ scenes: Scene[]; estimated_duration_sec: number }>(`/api/projects/${id}/scenes`),
	updateScene: (projectId: number, sceneId: number, payload: Record<string, unknown>) =>
		api<Scene>(`/api/projects/${projectId}/scenes/${sceneId}`, {
			method: 'PATCH',
			body: JSON.stringify(payload),
		}),
	createScene: (projectId: number, payload: Record<string, unknown>) =>
		api<Scene>(`/api/projects/${projectId}/scenes`, {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
	deleteScene: (projectId: number, sceneId: number) =>
		api<{ ok: boolean }>(`/api/projects/${projectId}/scenes/${sceneId}`, { method: 'DELETE' }),
	reorderScenes: (projectId: number, sceneIds: number[]) =>
		api<{ scenes: Scene[] }>(`/api/projects/${projectId}/scenes/reorder`, {
			method: 'POST',
			body: JSON.stringify({ scene_ids: sceneIds }),
		}),
	createClip: (projectId: number, sceneId: number, payload: Record<string, unknown>) =>
		api<Clip>(`/api/projects/${projectId}/scenes/${sceneId}/clips`, {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
	updateClip: (projectId: number, clipId: number, payload: Record<string, unknown>) =>
		api<Clip>(`/api/projects/${projectId}/clips/${clipId}`, {
			method: 'PATCH',
			body: JSON.stringify(payload),
		}),
	deleteClip: (projectId: number, clipId: number) =>
		api<{ ok: boolean }>(`/api/projects/${projectId}/clips/${clipId}`, { method: 'DELETE' }),
	reorderClips: (projectId: number, sceneId: number, clipIds: number[]) =>
		api<{ ok: boolean }>(`/api/projects/${projectId}/scenes/${sceneId}/clips/reorder`, {
			method: 'POST',
			body: JSON.stringify({ clip_ids: clipIds }),
		}),
	expandClips: (
		projectId: number,
		payload: { scene_ids?: number[]; all?: boolean; guidance?: string } = {},
	) =>
		api<{
			ok: boolean;
			scenes: Array<{ scene_id: number; clip_count: number; total_duration_sec: number }>;
			total_clips: number;
		}>(`/api/projects/${projectId}/expand-clips`, {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
	generateAssets: (
		id: number,
		payload: {
			missing_only?: boolean;
			character_ids?: number[];
			location_ids?: number[];
			item_ids?: number[];
			workflow_id?: number;
			input_values?: Record<string, unknown>;
			asset_target?: 'sheet';
			prompt?: string;
			router_model?: string;
		} = {},
	) =>
		api<{ ok: boolean; jobs: Job[] }>(`/api/projects/${id}/generate-assets`, {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
	getAssets: (id: number) =>
		api<{ characters: Character[]; locations: Location[]; items: Item[] }>(
			`/api/projects/${id}/assets`,
		),
};

export const settings = {
	get: () => api<Settings>('/api/settings'),
	/** Capabilities per LLM profile id as Ollama reports them (null = unknown server). */
	llmCapabilities: () =>
		api<Record<string, { capabilities: string[]; parameters?: string | null } | null>>(
			'/api/settings/llm/capabilities',
		),
	update: (payload: Record<string, unknown>) =>
		api<Settings>('/api/settings', { method: 'POST', body: JSON.stringify(payload) }),
	workflowRoles: () =>
		api<
			{
				key: string;
				label: string;
				hint: string;
				images: number;
				assigned: number | null;
				resolved: number | null;
				candidates: { id: number; name: string }[];
			}[]
		>('/api/settings/workflow-roles'),
	/**
	 * List the models an endpoint serves. `api_key` is only sent when the form
	 * holds an unsaved draft; otherwise the backend falls back to the key saved
	 * on `profile_id`. Pure metadata — llama.cpp answers without loading a model.
	 */
	llmModels: (payload: { profile_id?: string; base_url: string; api_key?: string }) =>
		api<LlmModelsResponse>('/api/settings/llm/models', {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
	/**
	 * Connectivity check: lists models, then sends one short completion with the
	 * profile's thinking setting applied. Loads the model on a cold endpoint, so
	 * pass a generous `timeout`.
	 */
	llmTest: (payload: {
		profile_id?: string;
		base_url: string;
		model: string;
		api_key?: string;
		thinking?: ThinkingMode;
		timeout?: number;
	}) =>
		api<LlmTestResponse>('/api/settings/llm/test', {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
};

/** A look for a project's pictures: category + name, style text, negative prompt, workflows by reference count. */
export interface RenderStyle {
	id: number;
	category: string;
	name: string;
	style_prompt: string;
	negative_prompt: string;
	workflows: Record<string, number>;
}

export const renderStylesApi = {
	list: () => api<RenderStyle[]>('/api/render-styles'),
	create: (payload: Omit<RenderStyle, 'id'>) =>
		api<RenderStyle>('/api/render-styles', { method: 'POST', body: JSON.stringify(payload) }),
	update: (id: number, payload: Partial<Omit<RenderStyle, 'id'>>) =>
		api<RenderStyle>(`/api/render-styles/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
	delete: (id: number) => api<{ ok: boolean }>(`/api/render-styles/${id}`, { method: 'DELETE' }),
};

/** One prompt Calliope sends (prompt_library.py): where and when it is used; fixed texts are editable. */
export interface PromptEntry {
	key: string;
	name: string;
	area: string;
	description: string;
	where: string;
	when: string;
	role: string;
	source: string;
	link: string;
	placeholders: string[];
	editable: boolean;
	built_from: string;
	kind: string;
	default: string;
	text: string;
	overridden: boolean;
	image_path: string | null;
	updated_at: string | null;
}

export const promptsApi = {
	list: () => api<PromptEntry[]>('/api/prompts'),
	update: (key: string, payload: { text?: string; reset?: boolean; image_path?: string }) =>
		api<PromptEntry>(`/api/prompts/${key}`, { method: 'PATCH', body: JSON.stringify(payload) }),
	uploadImage: (key: string, file: File) => {
		const form = new FormData();
		form.append('file', file);
		return apiUpload<PromptEntry>(`/api/prompts/${key}/image`, form);
	},
};

export type DepKind =
	| 'beat' | 'character' | 'location' | 'item' | 'scene' | 'clip' | 'panel'
	| 'library' | 'style' | 'workflow' | 'prompt';

/** One thing in a project's dependency map. */
export interface DepNode {
	id: string;
	kind: DepKind;
	label: string;
	column: number;
	entity_id?: number;
	image?: string | null;
	link?: string;
	key?: string;
	enabled?: boolean;
	rendered?: boolean;
	has_sheet?: boolean;
	missing_refs?: string[];
}

/** "target is built from / uses source". */
export interface DepEdge {
	id: string;
	source: string;
	target: string;
	rel: string;
	configurable?: 'scene_character' | 'scene_location';
	outdated?: boolean;
}

export interface DepFinding {
	type: string;
	severity: 'warn' | 'info';
	nodes: string[];
	text: string;
	action?: 'delete' | 'merge' | 'update_from_library';
}

export interface DepMap {
	project: { id: number; title: string; format: string | null };
	nodes: DepNode[];
	edges: DepEdge[];
	findings: DepFinding[];
}

type DepConnection = { kind: 'scene_character' | 'scene_location'; source_id: number; target_id: number };

export const dependenciesApi = {
	get: (projectId: number, prompts = false) =>
		api<DepMap>(`/api/projects/${projectId}/dependencies${prompts ? '?prompts=true' : ''}`),
	unlink: (projectId: number, c: DepConnection) =>
		api<{ ok: boolean }>(`/api/projects/${projectId}/dependencies/unlink`, { method: 'POST', body: JSON.stringify(c) }),
	link: (projectId: number, c: DepConnection) =>
		api<{ ok: boolean }>(`/api/projects/${projectId}/dependencies/link`, { method: 'POST', body: JSON.stringify(c) }),
	merge: (projectId: number, kind: 'character' | 'location', keepId: number, dropId: number) =>
		api<Record<string, unknown>>(`/api/projects/${projectId}/dependencies/merge`, {
			method: 'POST',
			body: JSON.stringify({ kind, keep_id: keepId, drop_id: dropId }),
		}),
};

/** One step of a project's process map (agent/process_map.py). */
export interface ProcessStep {
	key: string;
	phase: string;
	name: string;
	description: string;
	needs: { what: string; label: string; have: number }[];
	produces: { what: string; label: string; have: number }[];
	status: 'done' | 'partial' | 'ready' | 'blocked' | 'optional';
	progress: { have: number; of: number } | null;
	model: { role: string; name: string | null; model: string | null } | null;
	workflows: { role: string; label: string; workflow_id: number | null; workflow: string | null; from_style: boolean }[];
	prompts: { key: string; name: string; editable: boolean }[];
	style: { id: number | null; name?: string } | null;
	start: { method: string; path: string; body: Record<string, unknown> | null; confirm: string } | null;
	page: string;
}

export interface ProcessMap {
	format: string;
	phases: { key: string; name: string; hint: string }[];
	steps: ProcessStep[];
	edges: { id: string; source: string; target: string; label: string }[];
	counts: Record<string, number>;
}

export const processApi = {
	get: (projectId: number) => api<ProcessMap>(`/api/projects/${projectId}/process-map`),
	/** Start a step: the call its map entry names. */
	start: (s: NonNullable<ProcessStep['start']>) =>
		api<unknown>(s.path, { method: s.method, body: s.body ? JSON.stringify(s.body) : undefined }),
};

export const workflows = {
	list: () => api<Workflow[]>('/api/workflows'),
	analyze: (workflow_json: Record<string, unknown>) =>
		api<{
			inputs: ComfyDynamicInput[];
			outputs: ComfyDynamicOutput[];
			suggested_profile?: string;
			suggested_skill?: string | null;
		}>('/api/workflows/analyze', {
			method: 'POST',
			body: JSON.stringify({ workflow_json }),
		}),
	reanalyze: (id: number) =>
		api<Workflow>(`/api/workflows/${id}/reanalyze`, { method: 'POST' }),
	create: (payload: {
		name: string;
		kind: 'image' | 'video';
		workflow_json: Record<string, unknown>;
		description?: string;
		prompt_profile?: string;
		prompt_skill?: string | null;
		strict_mode?: boolean;
	}) => api<Workflow>('/api/workflows', { method: 'POST', body: JSON.stringify(payload) }),
	update: (
		id: number,
		payload: Partial<{
			name: string;
			kind: string;
			is_enabled: boolean;
			strict_mode: boolean;
			description: string;
			prompt_profile: string;
			prompt_skill: string | null;
		}>,
	) => api<Workflow>(`/api/workflows/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
	/** Suggest a prompt format + skill (node match, else the main LLM); changes nothing. */
	checkFormat: (id: number) =>
		api<{
			profile: string;
			skill: string | null;
			family: string | null;
			source: 'nodes' | 'llm';
			reason: string;
			current_profile: string;
			current_skill: string | null;
		}>(`/api/workflows/${id}/check-format`, { method: 'POST' }),
	/** Have the main LLM draft a prompt skill for this workflow's model family. */
	draftSkill: (id: number) =>
		api<{ name: string; family: string; path: string }>(`/api/workflows/${id}/draft-skill`, {
			method: 'POST',
		}),
	delete: (id: number) => api<{ ok: boolean }>(`/api/workflows/${id}`, { method: 'DELETE' }),
	get: (id: number) => api<Workflow>(`/api/workflows/${id}`),
};

export interface QueueJob {
	id: number;
	status: string;
	kind: string;
	project_id: number;
	project: string | null;
	/** What the job makes, e.g. "Character sheet · Reed", "Panel #12". */
	label: string;
	/** Place in the queue (1 = next), for queued jobs. */
	position: number | null;
	created_at: string;
	started_at: string | null;
	completed_at: string | null;
	error: string | null;
	output: string | null;
	/** Forecast (running/queued): usual seconds for this workflow, and when this job should be done (UTC). */
	typical_sec?: number;
	remaining_sec?: number;
	eta?: string;
	estimate_from?: 'workflow' | 'kind' | 'default';
}

export interface QueueOverview {
	running: QueueJob[];
	queued: QueueJob[];
	recent: QueueJob[];
	/** Jobs of other projects in the same queue (they run first or in between). */
	elsewhere: { running: number; queued: number };
	/** When the last of these jobs should be done (UTC). */
	finish_at: string | null;
}

export const jobsApi = {
	get: (id: number) => api<Job>(`/api/jobs/${id}`),
	active: (projectId?: number) =>
		api<QueueOverview>(`/api/jobs/active${projectId != null ? `?project_id=${projectId}` : ''}`),
	list: (projectId?: number) =>
		api<Job[]>(`/api/jobs${projectId != null ? `?project_id=${projectId}` : ''}`),
	retry: (id: number) => api<Job>(`/api/jobs/${id}/retry`, { method: 'POST' }),
	cancel: (id: number) => api<{ ok: boolean }>(`/api/jobs/${id}/cancel`, { method: 'POST' }),
	pause: () => api<{ ok: boolean; paused: boolean }>('/api/jobs/pause', { method: 'POST' }),
	resume: () => api<{ ok: boolean; paused: boolean }>('/api/jobs/resume', { method: 'POST' }),
	queueStatus: () => api<{ paused: boolean }>('/api/jobs/queue-status'),
	generateVideos: (
		projectId: number,
		payload: {
			scene_ids?: number[];
			clip_ids?: number[];
			workflow_id?: number;
			input_values?: Record<string, unknown>;
			prompts?: Record<string, string>;
			router_model?: string;
			router_images?: { path: string; name: string }[];
			duration_sec?: number;
		} = {},
	) =>
		api<{ ok: boolean; jobs: Job[] }>(`/api/jobs/projects/${projectId}/generate-videos`, {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
	previewPrompt: (
		projectId: number,
		payload: {
			clip_id?: number;
			scene_id?: number;
			workflow_id?: number;
			input_values?: Record<string, unknown>;
			force?: boolean;
		},
	) =>
		api<{
			prompt: string;
			profile: string;
			from_draft: boolean;
			based_on: string;
			critic?: { ok: boolean; notes: string[] };
		}>(`/api/jobs/projects/${projectId}/preview-prompt`, {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
	/**
	 * Compile H3 prompts without queueing a render. One call covers both
	 * "recompile this shot" (clip_ids: [id]) and "fill the gaps"
	 * (only_missing: true). Prompts are saved, so the Generate that follows
	 * spends no LLM call at all.
	 */
	batchPrompt: (
		projectId: number,
		payload: {
			clip_ids?: number[];
			workflow_id?: number;
			input_values?: Record<string, unknown>;
			force?: boolean;
			only_missing?: boolean;
			save?: boolean;
		},
	) =>
		api<{
			results: {
				clip_id: number;
				label: string;
				ok: boolean;
				prompt?: string;
				profile?: string;
				from_draft?: boolean;
				saved?: boolean;
				error?: string;
			}[];
			skipped: number;
			total: number;
			endpoint_dead: boolean;
			compiled: number;
			failed: number;
		}>(`/api/jobs/projects/${projectId}/batch-prompt`, {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
	exportFilm: (projectId: number) =>
		api<{ ok: boolean; job: Job }>(`/api/jobs/projects/${projectId}/export`, { method: 'POST' }),
};

export type PlaygroundAttachTarget = 'character_sheet' | 'location' | 'item' | 'scene';

export type UploadKind = 'image' | 'video' | 'audio' | 'document';

export interface PlaygroundUpload {
	ok: boolean;
	path: string;
	name: string;
	kind: UploadKind;
}

export interface PlaygroundUploadListItem {
	name: string;
	path: string;
	kind: UploadKind;
	size: number;
	mtime: string;
}

export const playgroundApi = {
	project: () => api<Project>('/api/playground/project'),
	jobs: () => api<Job[]>('/api/playground/jobs'),
	generate: (payload: { workflow_id: number; input_values?: Record<string, unknown> }) =>
		api<{ ok: boolean; job: Job }>('/api/playground/generate', {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
	upload: (file: File) => {
		const form = new FormData();
		form.append('file', file);
		return apiUpload<PlaygroundUpload>('/api/playground/uploads', form);
	},
	listUploads: () => api<PlaygroundUploadListItem[]>('/api/playground/uploads'),
	deleteJob: (jobId: number) =>
		api<{ ok: boolean; job_id: number; deleted_files: string[]; missing_files: string[] }>(
			`/api/playground/jobs/${jobId}`,
			{ method: 'DELETE' },
		),
	attach: (payload: {
		path: string;
		project_id: number;
		target: PlaygroundAttachTarget;
		character_id?: number;
		location_id?: number;
		item_id?: number;
		scene_id?: number;
		name?: string;
	}) =>
		api<{ ok: boolean; path: string; target: string; project_id: number; item_id?: number }>(
			'/api/playground/attach',
			{ method: 'POST', body: JSON.stringify(payload) },
		),
};

// ── Asset Library (unlinked Playground media) ───────────────────────────

export interface LibraryMediaItem {
	path: string;
	name: string;
	kind: 'image' | 'video';
	size: number;
	mtime: string;
}

export interface LibraryDeleteResult {
	path: string;
	status: 'deleted' | 'kept';
	reason?: string;
}

export const libraryApi = {
	list: () => api<LibraryMediaItem[]>('/api/library/media'),
	deleteMany: (paths: string[]) =>
		api<{
			ok: boolean;
			deleted: string[];
			results: LibraryDeleteResult[];
		}>('/api/library/media', { method: 'DELETE', body: JSON.stringify({ paths }) }),
};

// ── Agents (agentic harness) ────────────────────────────────────────────

export interface AgentSession {
	id: number;
	project_id: number | null;
	title: string;
	status: 'idle' | 'running' | 'error';
	/** WHERE the session was born: 'chat' (AI Canvas) or 'scene' (Build Scene rail). */
	origin: 'chat' | 'scene';
	created_at: string;
	updated_at: string;
	running?: boolean;
	project?: { id: number; title: string; status: string } | null;
}

export interface AgentMessage {
	id: number;
	session_id: number;
	role: 'user' | 'assistant' | 'tool' | 'system';
	content: string;
	agent_name?: string | null;
	tool_name?: string | null;
	tool_args?: Record<string, unknown> | null;
	tool_result?: unknown;
	status?: string | null;
	reasoning?: string | null;
	created_at: string;
	mentions?: AgentComposerPayload['mentions'];
	attachments?: AgentComposerPayload['attachments'];
}

export interface AgentTask {
	role: string;
	goal: string;
	status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
	index?: number;
}

export interface AgentPlan {
	tasks: AgentTask[];
	note?: string | null;
}

export const agentApi = {
	listSessions: (projectId?: number) =>
		api<AgentSession[]>(
			`/api/agent/sessions${projectId != null ? `?project_id=${projectId}` : ''}`,
		),
	listSceneSessions: () => api<AgentSession[]>('/api/agent/sessions?origin=scene'),
	listLinkableProjects: () =>
		api<{ id: number; title: string; status: string }[]>('/api/agent/projects'),
	createSession: (payload: { title?: string; project_id?: number | null; origin?: 'chat' | 'scene' }) =>
		api<AgentSession>('/api/agent/sessions', {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
	getSession: (id: number) =>
		api<AgentSession & { messages: AgentMessage[]; plan?: AgentPlan | null }>(
			`/api/agent/sessions/${id}`,
		),
	patchSession: (
		id: number,
		payload: { title?: string; project_id?: number | null; unlink?: boolean },
	) =>
		api<AgentSession>(`/api/agent/sessions/${id}`, {
			method: 'PATCH',
			body: JSON.stringify(payload),
		}),
	deleteSession: (id: number) =>
		api<{ ok: boolean }>(`/api/agent/sessions/${id}`, { method: 'DELETE' }),
	postMessage: (id: number, payload: AgentComposerPayload | string) => {
		const body =
			typeof payload === 'string'
				? { content: payload, mentions: [], attachments: [] }
				: payload;
		return api<{ ok: boolean; steered?: boolean; message: AgentMessage }>(`/api/agent/sessions/${id}/messages`, {
			method: 'POST',
			body: JSON.stringify(body),
		});
	},
	cancel: (id: number) =>
		api<{ ok: boolean }>(`/api/agent/sessions/${id}/cancel`, { method: 'POST' }),
	listSkills: () =>
		api<{ name: string; description: string; version: string; tags: string[]; dir: string }[]>(
			'/api/agent/skills',
		),
	listMemories: () =>
		api<
			{
				id: number;
				scope: 'global' | 'project';
				project_id: number | null;
				project_title: string | null;
				content: string;
				kind: string;
				source: string;
				use_count: number;
				created_at: string;
			}[]
		>('/api/agent/memories'),
	addMemory: (payload: {
		content: string;
		scope: 'global' | 'project';
		project_id?: number | null;
		kind?: string;
	}) =>
		api<{ ok: boolean; id: number }>('/api/agent/memories', {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
	deleteMemory: (id: number) =>
		api<{ ok: boolean }>(`/api/agent/memories/${id}`, { method: 'DELETE' }),
	skillsPath: () => api<{ path: string }>('/api/agent/skills/path'),
	skillFiles: (name: string) => api<{ skill: string; files: string[] }>(`/api/agent/skills/${encodeURIComponent(name)}/files`),
	readSkillFile: (name: string, path: string) =>
		api<{ ok: boolean; content: string; truncated: boolean }>(
			`/api/agent/skills/${encodeURIComponent(name)}/file?path=${encodeURIComponent(path)}`,
		),
};

export interface CanvasInfo {
	id: number;
	title: string;
	project_id: number | null;
	agent_session_id: number | null;
	updated_at: string;
}

export interface CanvasNode {
	id: number;
	canvas_id: number;
	type: 'entity' | 'image' | 'video' | 'text' | 'workflow';
	title: string | null;
	x: number;
	y: number;
	width: number | null;
	height: number | null;
	workflow_id: number | null;
	artifact_path: string | null;
	job_id: number | null;
	status: string;
	input_values_json: string;
	entity_type: string | null;
	entity_id: number | null;
}

export interface CanvasEdge {
	id: number;
	canvas_id: number;
	src_node_id: number;
	dst_node_id: number;
	kind: 'data' | 'link';
	label: string | null;
	dst_role: string | null;
	dst_comfy_node_id: string | null;
}

export interface CanvasGraph {
	canvas: CanvasInfo & {
		project?: { id: number; title: string } | null;
		viewport_json?: string | null;
	};
	nodes: CanvasNode[];
	edges: CanvasEdge[];
}

export const canvasApi = {
	list: () => api<CanvasInfo[]>('/api/canvas'),
	ensureForProject: (projectId: number, title?: string) =>
		api<CanvasGraph>('/api/canvas', {
			method: 'POST',
			body: JSON.stringify({ project_id: projectId, ...(title ? { title } : {}) }),
		}),
	ensureForSession: (sessionId: number) =>
		api<CanvasGraph>('/api/canvas', {
			method: 'POST',
			body: JSON.stringify({ agent_session_id: sessionId }),
		}),
	get: (id: number) => api<CanvasGraph>(`/api/canvas/${id}`),
	patchCanvas: (id: number, payload: { title?: string; viewport_json?: string }) =>
		api<CanvasInfo & { project?: { id: number; title: string } | null; viewport_json?: string | null }>(
			`/api/canvas/${id}`,
			{
				method: 'PATCH',
				body: JSON.stringify(payload),
			},
		),
	patchNode: (
		canvasId: number,
		nodeId: number,
		payload: {
			x?: number;
			y?: number;
			title?: string;
			input_values_json?: string;
			status?: string;
			job_id?: number;
			artifact_path?: string;
		},
	) =>
		api<CanvasNode>(`/api/canvas/${canvasId}/nodes/${nodeId}`, {
			method: 'PATCH',
			body: JSON.stringify(payload),
		}),
	createNode: (
		canvasId: number,
		payload: {
			type: 'workflow' | 'image' | 'video';
			title?: string;
			x?: number;
			y?: number;
			workflow_id?: number;
			artifact_path?: string;
			job_id?: number;
			status?: string;
			input_values_json?: string;
		},
	) =>
		api<CanvasNode>(`/api/canvas/${canvasId}/nodes`, {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
	deleteNode: (canvasId: number, nodeId: number) =>
		api<{ ok: boolean; file_deleted?: boolean; reason?: string | null }>(
			`/api/canvas/${canvasId}/nodes/${nodeId}`,
			{ method: 'DELETE' },
		),
	tidy: (canvasId: number) =>
		api<{ ok: boolean; moved: number }>(`/api/canvas/${canvasId}/tidy`, { method: 'POST' }),
	createEdge: (
		canvasId: number,
		payload: {
			src_node_id: number;
			dst_node_id: number;
			kind: 'data' | 'link';
			label?: string;
			dst_role?: string;
			dst_comfy_node_id?: string;
		},
	) =>
		api<CanvasEdge>(`/api/canvas/${canvasId}/edges`, {
			method: 'POST',
			body: JSON.stringify(payload),
		}),
	patchEdge: (canvasId: number, edgeId: number, payload: { label: string }) =>
		api<CanvasEdge>(`/api/canvas/${canvasId}/edges/${edgeId}`, {
			method: 'PATCH',
			body: JSON.stringify(payload),
		}),
	deleteEdge: (canvasId: number, edgeId: number) =>
		api<{ ok: boolean }>(`/api/canvas/${canvasId}/edges/${edgeId}`, { method: 'DELETE' }),
};
