package Plack::Debugger;

use strict;
use warnings;

use Scalar::Util qw[ blessed ];

use Plack::Debugger::Panel;


sub new {
    my $class = shift;
    my %args  = @_;

    die "You must provide a storage backend"
        unless exists $args{'storage'};

    die "The storage backend must be a subclass of 'Plack::Debugger::Storage'"
        unless blessed $args{'storage'} && $args{'storage'}->isa('Plack::Debugger::Storage');

    if (exists $args{'panels'}) {
        die "You must provide panels as an ARRAY ref"
            unless ref $args{'panels'} eq 'ARRAY';

        foreach my $panel ( @{$args{'panels'}} ) {
            die "Panel object must be a subclass of Plack::Debugger::Panel"
                unless blessed $panel && $panel->isa('Plack::Debugger::Panel');
        }
    }

    bless {
        storage => $args{'storage'},
        panels  => $args{'panels'} || []
    } => $class;
}

sub storage       { (shift)->{'storage'}       } # a Plack::Debugger::Storage instance (required)
sub panels        { (shift)->{'panels'}        } # array ref of Plack::Debugger::Panel objects (optional)

sub run_before_phase {
    my ($self, $env) = @_;
    foreach my $panel ( @{ $self->{'panels'} } ) {
        $panel->before->( $panel, $env ) if $panel->has_before;
    }
}

sub run_after_phase {
    my ($self, $env, $resp) = @_;
    foreach my $panel ( @{ $self->{'panels'} } ) {
        $panel->after->( $panel, $env, $resp ) if $panel->has_after;
    }
}

sub run_cleanup_phase {
    my ($self, $env) = @_;
    foreach my $panel ( @{ $self->{'panels'} } ) {
        $panel->cleanup->( $panel, $env ) if $panel->has_cleanup;
    }
}

sub store_results {
    my $self = shift;

    my %results;
    foreach my $panel ( @{ $self->{'panels'} } ) {
        $results{ $panel->title } = $panel->get_result;
    }
    
    $self->storage->store( \%results );

    $_->reset foreach @{ $self->{'panels'} };
}

1;

__END__