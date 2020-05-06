export interface LibraryManifestAlias {
    link: string
    fliph: string
    flipv: string
}

export interface LibraryManifest {
    name: string
    version: string
    assets: Record<string, any>
    aliases: Record<string, LibraryManifestAlias>
}

export interface LibraryJson {
    manifest: LibraryManifest
    spritesheet: Object
    animations: Object
}