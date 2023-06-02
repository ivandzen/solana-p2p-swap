# Install BPF SDK
FROM solanalabs/rust:1.64.0 AS builder
RUN cargo install rustfilt
WORKDIR /opt
RUN sh -c "$(curl -sSfL https://release.solana.com/v1.14.16/install)" && \
    /root/.local/share/solana/install/active_release/bin/sdk/bpf/scripts/install.sh
ENV PATH=/root/.local/share/solana/install/active_release/bin:/usr/local/cargo/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

FROM builder AS p2p-swap-builder
COPY ./ /opt/
WORKDIR /opt/
RUN cargo fmt --check && \
    cargo build-sbf --arch bpf

RUN ls -la ./target/deploy/

FROM solanalabs/solana:v1.14.16 AS solana

# Build target image
FROM ubuntu:20.04 AS base
WORKDIR /opt
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get -y install vim less openssl ca-certificates curl python3 python3-pip parallel && \
    rm -rf /var/lib/apt/lists/*

COPY --from=solana /usr/bin/spl-token /usr/bin/solana /usr/bin/solana-keygen /usr/bin/solana-faucet /usr/bin/
COPY --from=p2p-swap-builder /opt/target/deploy/p2p_swap.so /opt/

COPY deploy_contract.sh \
    p2p-swap-keypair.json \
    /opt/

ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/opt
