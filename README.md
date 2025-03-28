# Usage Guide

## Prerequisites
- Docker installation
- Two phone numbers:
    - One for WhatsApp authentication
    - One for administrator access

## Environment Setup
1. Copy the environment and Docker Compose files from the repository.
2. Configure your `.env` file with:
    ```plaintext
    PHONE=your_whatsapp_number
    USE_PAIRING=true
    ```

## Running with Docker Compose
1. Pull and run the container:
    ```bash
    docker compose up -d
    ```
2. Stop the service:
    ```bash
    docker compose down
    ```

## Development Setup
If you want to develop or contribute:

1. Clone the repository:
    ```bash
    git clone https://github.com/miruchigawa/Anna.git
    cd Anna
    ```
2. Install dependencies using Bun:
    ```bash
    bun install
    ```
3. Copy and configure the environment file as shown in Environment Setup section
4. Run in development mode:
    ```bash
    bun dev
    ```

## Contributing
Feel free to submit issues or pull requests to improve this project.

## License
This project is licensed under the [MIT License](LICENSE).
