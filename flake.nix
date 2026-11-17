{
  description = "agent_gatekeeper";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      supported_systems = [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" ];
      for_each_supported_system = nixpkgs.lib.genAttrs supported_systems;
    in
    {
      devShells = for_each_supported_system (system:
        let
          pkgs = import nixpkgs { inherit system; };

          default_shell = pkgs.mkShellNoCC {
            packages = [ pkgs.bun pkgs.nodejs ];
          };
        in
        {
          default = default_shell;
          agent = self.devShells.${system}.default;
        });
    };
}
