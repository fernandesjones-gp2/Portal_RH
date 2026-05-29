# Infrastructure as Code — Terraform Guide

## Índice
1. Quando Usar Terraform
2. Estrutura de Projeto
3. Módulos Essenciais
4. State Management
5. AWS — Templates Comuns
6. DigitalOcean / VPS — Template Simples
7. Boas Práticas

---

## 1. Quando Usar Terraform

| Cenário | Terraform? | Alternativa |
|---------|-----------|-------------|
| 1 VPS + docker-compose | Não necessário | Setup manual + scripts |
| 2-3 serviços na cloud | Pode usar (vale para reprodutibilidade) | Console + documentar |
| Multi-serviço com rede, LB, DB | Sim, obrigatório | Caos |
| Multi-region / multi-account | Sim, obrigatório | Impossível manter manual |
| Infra que é recriada frequentemente | Sim | Scripts bash (frágeis) |

**Regra**: Se a infra tem mais de 5 recursos cloud ou se mais de 1 pessoa
a gerencia, use Terraform. Caso contrário, scripts documentados são aceitáveis.

---

## 2. Estrutura de Projeto

```
infra/
├── main.tf                  ← Recursos principais
├── variables.tf             ← Declaração de variáveis
├── outputs.tf               ← Outputs (IPs, URLs, etc.)
├── providers.tf             ← Provider configs (AWS, DO, etc.)
├── versions.tf              ← Version constraints
├── terraform.tfvars         ← Valores (GITIGNORED)
├── terraform.tfvars.example ← Template (commitado)
├── backend.tf               ← Remote state config
├── environments/
│   ├── staging.tfvars       ← Valores para staging
│   └── production.tfvars    ← Valores para produção
└── modules/
    ├── networking/           ← VPC, subnets, security groups
    ├── compute/              ← EC2, ECS, Cloud Run
    ├── database/             ← RDS, Cloud SQL
    └── monitoring/           ← CloudWatch, alarms
```

### versions.tf

```hcl
terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
```

### providers.tf

```hcl
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
```

### variables.tf

```hcl
variable "project_name" {
  description = "Nome do projeto"
  type        = string
}

variable "environment" {
  description = "Ambiente (staging, production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment deve ser 'staging' ou 'production'."
  }
}

variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "us-east-1"
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true  # Nunca aparece em logs/output
}
```

### terraform.tfvars.example

```hcl
# terraform.tfvars.example — COPIAR para terraform.tfvars e preencher
project_name = "meu-projeto"
environment  = "staging"
aws_region   = "us-east-1"
db_password  = "CHANGE_ME"
```

---

## 3. Módulos Essenciais

### Networking (VPC + Subnets)

```hcl
# modules/networking/main.tf
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "${var.project_name}-vpc" }
}

resource "aws_subnet" "public" {
  count             = length(var.public_subnets)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.public_subnets[count.index]
  availability_zone = var.azs[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "${var.project_name}-public-${count.index}" }
}

resource "aws_subnet" "private" {
  count             = length(var.private_subnets)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnets[count.index]
  availability_zone = var.azs[count.index]

  tags = { Name = "${var.project_name}-private-${count.index}" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
}

resource "aws_security_group" "app" {
  name_prefix = "${var.project_name}-app-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "db" {
  name_prefix = "${var.project_name}-db-"
  vpc_id      = aws_vpc.main.id

  # APENAS acessível pelo app security group
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
}
```

### Database (RDS PostgreSQL)

```hcl
resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-db-${var.environment}"
  engine         = "postgres"
  engine_version = "16"
  instance_class = var.environment == "production" ? "db.t3.medium" : "db.t3.micro"

  allocated_storage     = 20
  max_allocated_storage = 100  # Auto-scaling de storage

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  # Backup
  backup_retention_period = var.environment == "production" ? 30 : 7
  backup_window          = "03:00-04:00"

  # Manutenção
  maintenance_window = "sun:04:00-sun:05:00"

  # Segurança
  storage_encrypted = true
  multi_az          = var.environment == "production"

  # Proteção contra delete acidental
  deletion_protection = var.environment == "production"

  skip_final_snapshot       = var.environment != "production"
  final_snapshot_identifier = "${var.project_name}-final-snapshot"

  tags = { Name = "${var.project_name}-db" }
}
```

---

## 4. State Management

### Remote State (obrigatório para times)

```hcl
# backend.tf
terraform {
  backend "s3" {
    bucket         = "myproject-terraform-state"
    key            = "infra/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}
```

```
Regras de state:
├── NUNCA committar terraform.tfstate no git
├── Usar remote state (S3, GCS, Terraform Cloud)
├── Habilitar locking (DynamoDB para S3)
├── Habilitar encryption at rest
├── State separado por ambiente (staging/prod)
└── Fazer backup do state bucket
```

---

## 5. DigitalOcean / VPS — Template Simples

Para projetos que não precisam de AWS completa:

```hcl
# Para DigitalOcean
terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

provider "digitalocean" {
  token = var.do_token
}

resource "digitalocean_droplet" "app" {
  image    = "docker-20-04"
  name     = "${var.project_name}-${var.environment}"
  region   = var.region
  size     = var.environment == "production" ? "s-2vcpu-4gb" : "s-1vcpu-1gb"
  ssh_keys = [digitalocean_ssh_key.main.fingerprint]

  user_data = <<-EOF
    #!/bin/bash
    apt-get update
    apt-get install -y docker-compose-plugin nginx certbot python3-certbot-nginx
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 22/tcp
    ufw --force enable
  EOF

  tags = [var.project_name, var.environment]
}

resource "digitalocean_firewall" "app" {
  name        = "${var.project_name}-fw"
  droplet_ids = [digitalocean_droplet.app.id]

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = [var.admin_ip]  # SSH apenas do IP do admin
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "all"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

output "server_ip" {
  value = digitalocean_droplet.app.ipv4_address
}
```

---

## 6. Boas Práticas

```
Organização:
├── 1 módulo = 1 responsabilidade (networking, compute, db)
├── Variables têm description e type SEMPRE
├── Outputs para valores que outros módulos/humanos precisam
├── terraform fmt antes de commit
├── terraform validate no CI
└── terraform plan antes de apply (SEMPRE revisar o plan)

Segurança:
├── Variáveis sensitive = true para secrets
├── State encrypted at rest
├── Minimal permissions no provider (IAM role com least privilege)
├── Nunca hardcodar credentials (usar env vars ou instance profile)
└── tfvars com secrets no .gitignore

Ambientes:
├── Mesmos módulos, tfvars diferentes
├── terraform workspace OU diretórios separados
├── Staging SEMPRE menor e mais barato que produção
└── Testar terraform plan no CI antes de apply
```
