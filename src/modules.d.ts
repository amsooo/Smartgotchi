// Pozwala importować pliki .md jako zwykły tekst (konfiguracja w wrangler.toml → [[rules]]).
declare module "*.md" {
  const content: string;
  export default content;
}
